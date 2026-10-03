import type {
  Message,
  ModelAdapter,
  ModelChunk,
  ModelRequest,
  SessionEvent,
  Tool,
} from '../src/index.js'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { z } from 'zod'
import {
  compactMessages,
  configSchema,
  runAgent as executeAgent,
  fileTools,
  hash,
  Session,
} from '../src/index.js'
import { createTaskScope } from './taskScope'

let root: string
let tasks: ReturnType<typeof createTaskScope>
beforeEach(async ({ signal }) => {
  tasks = createTaskScope(signal)
  root = await mkdtemp(path.join(tmpdir(), 'weapp-engine-'))
  process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')
})
afterEach(async () => {
  await tasks.close()
  delete process.env.WEAPP_AGENT_STATE_DIR
  delete process.env.TEST_API_KEY
  await rm(root, { recursive: true, force: true })
})
function runAgent(options: Parameters<typeof executeAgent>[0]) {
  return tasks.run(() => executeAgent({
    ...options,
    signal: options.signal ? AbortSignal.any([tasks.signal, options.signal]) : tasks.signal,
  }))
}
const config = configSchema.parse({
  model: { provider: 'openai', name: 'test' },
})
function scripted(
  steps: ModelChunk[][],
): ModelAdapter & { requests: ModelRequest[] } {
  const requests: ModelRequest[] = []
  return {
    id: 'test',
    requests,
    async* stream(request) {
      requests.push(request)
      yield* steps.shift() ?? [{ type: 'text', text: 'Done' }]
    },
  }
}
function call(id: string, name: string, input: unknown): ModelChunk {
  return {
    type: 'call',
    call: { id, name, input },
  }
}
// 两轮会话逐条 fsync 日志；Windows 完整 coverage 曾超过默认 5 秒，保留真实持久化并单独分配集成预算。
it('completes a read/edit/verify loop, preserves existing user content, and resumes without replay', { timeout: 30_000 }, () => tasks.run(async () => {
  const source = 'user customization\ncount: 0\n'
  await writeFile(path.join(root, 'page.ts'), source)
  const model = scripted([
    [call('r', 'read_file', { path: 'page.ts' })],
    [
      call('w', 'edit_file', {
        path: 'page.ts',
        expectedHash: hash(source),
        oldText: 'count: 0',
        newText: 'count: 1',
      }),
    ],
    [call('v', 'verify_project', {})],
    [{ type: 'text', text: 'Updated and verified' }],
  ])
  let checks = 0
  const verification: Tool = {
    name: 'verify_project',
    description: 'test verification',
    schema: z.object({}),
    mutates: true,
    async execute() {
      checks++
      return { text: 'passed' }
    },
  }
  const result = await runAgent({
    root,
    config,
    model,
    tools: [...fileTools(), verification],
    prompt: 'increment',
    trusted: true,
  })
  expect(result.status).toBe('completed')
  expect(checks).toBe(1)
  expect(await readFile(path.join(root, 'page.ts'), 'utf8')).toBe(
    'user customization\ncount: 1\n',
  )
  const followup = scripted([
    [{ type: 'text', text: 'Previous edit preserved' }],
  ])
  await runAgent({
    root,
    config,
    model: followup,
    tools: fileTools(),
    prompt: 'status',
    sessionId: result.sessionId,
  })
  expect(
    followup.requests[0]!.messages.some(
      m => m.role === 'tool' && m.callId === 'w',
    ),
  ).toBe(true)
  expect(checks).toBe(1)
}))
it('requires verification after edits even if the model tries to finish early', async () => {
  const model = scripted([
    [call('w', 'create_file', { path: 'new.ts', content: 'export {}' })],
    [{ type: 'text', text: 'Done' }],
    [call('v', 'verify_project', {})],
    [{ type: 'text', text: 'Verified' }],
  ])
  const verification: Tool = {
    name: 'verify_project',
    description: '',
    schema: z.object({}),
    mutates: true,
    async execute() {
      return { text: 'passed' }
    },
  }
  const result = await runAgent({
    root,
    config,
    model,
    tools: [...fileTools(), verification],
    prompt: 'create',
    trusted: true,
  })
  expect(result.status).toBe('completed')
  expect(model.requests).toHaveLength(4)
})
it('rejects invalid tool arguments and lets the model repair the call', async () => {
  const model = scripted([
    [call('bad', 'read_file', { path: 3 })],
    [call('good', 'list_files', {})],
    [{ type: 'text', text: 'Recovered' }],
  ])
  await runAgent({ root, config, model, tools: fileTools(), prompt: 'read' })
  expect(
    model.requests[1]!.messages.some(m => m.role === 'tool' && m.error),
  ).toBe(true)
})
it('returns action_required in noninteractive mode without running shell', async () => {
  const model = scripted([[call('x', 'shell', { command: 'touch unsafe' })]])
  const result = await runAgent({
    root,
    config,
    model,
    tools: fileTools(),
    prompt: 'shell',
    trusted: true,
  })
  expect(result.status).toBe('action_required')
  await expect(readFile(path.join(root, 'unsafe'))).rejects.toThrow()
})
it('does not automatically replay an interrupted side effect', async () => {
  const session = new Session(root)
  await session.open()
  await session.append('message', {
    message: {
      role: 'assistant',
      text: '',
      calls: [
        { id: 'pending', name: 'shell', input: { command: 'touch duplicate' } },
      ],
    },
  })
  await session.append('tool.started', { callId: 'pending', mutates: true })
  await session.close()
  const model = scripted([])
  expect(
    (
      await runAgent({
        root,
        config,
        model,
        tools: fileTools(),
        prompt: 'continue',
        sessionId: session.id,
      })
    ).status,
  ).toBe('action_required')
  expect(model.requests).toHaveLength(0)
  const result = await runAgent({
    root,
    config,
    model,
    tools: fileTools(),
    prompt: 'I inspected the state',
    sessionId: session.id,
    acknowledgeInterrupted: true,
  })
  expect(result.status).toBe('completed')
  await expect(readFile(path.join(root, 'duplicate'))).rejects.toThrow()
  expect(
    model.requests[0]!.messages.some(
      m => m.role === 'tool' && m.error && m.callId === 'pending',
    ),
  ).toBe(true)
})
it('stops at the step limit and propagates cancellation', async () => {
  const model = scripted([
    [call('a', 'list_files', {})],
    [call('b', 'list_files', {})],
  ])
  expect(
    (
      await runAgent({
        root,
        config: { ...config, maxSteps: 1 },
        model,
        tools: fileTools(),
        prompt: 'loop',
      })
    ).status,
  ).toBe('limit_reached')
  const controller = new AbortController()
  controller.abort()
  expect(
    (
      await runAgent({
        root,
        config,
        model,
        tools: [],
        prompt: 'cancel',
        signal: controller.signal,
      })
    ).status,
  ).toBe('cancelled')
})
it('records a provider failure without replaying completed edits', async () => {
  let count = 0
  const model: ModelAdapter = {
    id: 'failure',
    async* stream() {
      if (count++ === 0) {
        yield call('w', 'create_file', { path: 'saved', content: 'once' })
      }
      else {
        throw new Error('connection reset')
      }
    },
  }
  const result = await runAgent({
    root,
    config,
    model,
    tools: fileTools(),
    prompt: 'write',
    trusted: true,
  })
  expect(result.status).toBe('failed')
  expect(await readFile(path.join(root, 'saved'), 'utf8')).toBe('once')
})
it('redacts secrets even when model output splits them across chunks', async () => {
  process.env.TEST_API_KEY = 'secret-value-for-test'
  const model = scripted([
    [
      { type: 'text', text: 'Key secret-val' },
      { type: 'text', text: 'ue-for-test\n' },
    ],
  ])
  const events: SessionEvent[] = []
  const result = await runAgent({
    root,
    config,
    model,
    tools: [],
    prompt: 'hi',
    onEvent: (e) => {
      events.push(e)
    },
  })
  expect(JSON.stringify(events)).not.toContain('secret-value-for-test')
  expect(JSON.stringify(events)).not.toContain('secret-val')
  expect(result.text).toContain('[REDACTED]')
})
it('compacts complete tool-call groups and retains recent user intent', () => {
  const messages: Message[] = [
    { role: 'user', text: 'old '.repeat(10000) },
    {
      role: 'assistant',
      text: '',
      calls: [{ id: 'a', name: 'read', input: {} }],
    },
    { role: 'tool', callId: 'a', name: 'read', result: { text: 'data' } },
    { role: 'user', text: 'Latest instruction' },
  ]
  const result = compactMessages(messages, 8000)
  expect(result.compacted).toBe(true)
  expect(JSON.stringify(result.messages).length).toBeLessThan(8000)
  expect(result.messages.at(-1)).toEqual(messages.at(-1))
  const calls = result.messages.flatMap(m =>
    m.role === 'assistant' ? (m.calls ?? []) : [],
  )
  expect(
    result.messages
      .filter(m => m.role === 'tool')
      .every(m => calls.some(c => c.id === m.callId)),
  ).toBe(true)
})

it('requires outstanding verification after resuming a completed edit', async () => {
  const first = await runAgent({
    root,
    config: { ...config, maxSteps: 1 },
    model: scripted([
      [
        call('edit', 'create_file', {
          path: 'pending.ts',
          content: 'export {}',
        }),
      ],
    ]),
    tools: fileTools(),
    trusted: true,
    prompt: 'edit',
  })
  const model = scripted([
    [{ type: 'text', text: 'Done' }],
    [call('verify', 'verify_project', {})],
    [{ type: 'text', text: 'Verified' }],
  ])
  const result = await runAgent({
    root,
    config,
    model,
    sessionId: first.sessionId,
    prompt: 'resume',
    tools: [
      {
        name: 'verify_project',
        description: '',
        schema: z.object({}),
        mutates: true,
        async execute() {
          return { text: 'passed' }
        },
      },
    ],
  })
  expect(result.status).toBe('completed')
  expect(model.requests).toHaveLength(3)
})

it('summarizes an oversized indivisible tool group without orphaned results', () => {
  const result = compactMessages(
    [
      { role: 'user', text: 'Latest goal' },
      {
        role: 'assistant',
        text: '',
        calls: [
          { id: 'huge', name: 'write', input: { content: 'x'.repeat(50000) } },
        ],
      },
      {
        role: 'tool',
        name: 'write',
        callId: 'huge',
        result: { text: 'done', data: 'x'.repeat(50000) },
      },
    ],
    8000,
  )
  expect(JSON.stringify(result.messages).length).toBeLessThan(8000)
  expect(result.messages.some(m => m.role === 'tool')).toBe(false)
  expect(JSON.stringify(result.messages)).toContain('Latest goal')
})
