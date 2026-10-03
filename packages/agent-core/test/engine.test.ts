import type {
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
  expect(model.requests[0]!.messages).toContainEqual({ role: 'user', origin: 'user', text: 'create', images: undefined })
  expect(model.requests[2]!.messages).toContainEqual({
    role: 'user',
    origin: 'engine',
    text: 'Files changed since the last verification. Call verify_project before finishing; report failed and unverified categories honestly.',
  })
})
it.each([undefined, { path: 3 }])('rejects invalid tool arguments %j and resumes after the model repairs the call', { timeout: 30_000 }, async (input) => {
  const model = scripted([
    [call('bad', 'read_file', input)],
    [call('good', 'list_files', {})],
    [{ type: 'text', text: 'Recovered' }],
  ])
  const first = await runAgent({ root, config, model, tools: fileTools(), prompt: 'read' })
  expect(
    model.requests[1]!.messages.some(m => m.role === 'tool' && m.error),
  ).toBe(true)
  expect(first.status).toBe('completed')
  const followup = scripted([[{ type: 'text', text: 'The invalid call was handled.' }]])
  const resumed = await runAgent({ root, config, model: followup, tools: fileTools(), prompt: 'status', sessionId: first.sessionId })
  expect(resumed.status).toBe('completed')
  expect(followup.requests).toHaveLength(1)
  expect(followup.requests[0]!.messages).toContainEqual(expect.objectContaining({ role: 'tool', callId: 'bad', error: true }))
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
it('requires inspection without replaying an interrupted side effect whose call ID was previously completed', { timeout: 30_000 }, async () => {
  const session = new Session(root)
  await session.open()
  await session.append('message', {
    message: {
      role: 'assistant',
      text: '',
      calls: [{ id: 'pending', name: 'shell', input: { command: 'echo completed' } }],
    },
  })
  await session.append('message', {
    message: { role: 'tool', name: 'shell', callId: 'pending', result: { text: 'completed' } },
  })
  await session.append('message', {
    message: {
      role: 'assistant',
      text: '',
      calls: [
        { id: 'pending', name: 'shell', input: { command: 'touch duplicate' } },
        { id: 'planned', name: 'create_file', input: { path: 'not-started', content: 'pending' } },
      ],
    },
  })
  await session.append('tool.started', { callId: 'pending', mutates: true })
  await session.close()
  const model = scripted([])
  const events: SessionEvent[] = []
  expect(
    (
      await runAgent({
        root,
        config,
        model,
        tools: fileTools(),
        prompt: 'continue',
        sessionId: session.id,
        onEvent: (event) => { events.push(event) },
      })
    ).status,
  ).toBe('action_required')
  expect(model.requests).toHaveLength(0)
  expect(events.find(event => event.type === 'recovery.required')?.data.calls).toEqual([
    expect.objectContaining({ id: 'pending', state: 'outcome_unknown' }),
    expect.objectContaining({ id: 'planned', state: 'not_executed' }),
  ])
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
  await expect(readFile(path.join(root, 'not-started'))).rejects.toThrow()
  expect(
    model.requests[0]!.messages.some(
      m => m.role === 'tool' && m.error && m.callId === 'pending',
    ),
  ).toBe(true)
  expect(model.requests[0]!.messages).toContainEqual(expect.objectContaining({
    role: 'tool',
    callId: 'pending',
    error: true,
    result: { text: expect.stringContaining('outcome unknown') },
  }))
  expect(model.requests[0]!.messages).toContainEqual(expect.objectContaining({
    role: 'tool',
    callId: 'planned',
    error: true,
    result: { text: expect.stringContaining('Not executed:') },
  }))
  const resumed = await runAgent({
    root,
    config,
    model,
    tools: fileTools(),
    prompt: 'Continue after the completed recovery.',
    sessionId: session.id,
    onEvent: (event) => { events.push(event) },
  })
  expect(resumed.status).toBe('completed')
  expect(model.requests).toHaveLength(2)
  expect(events.filter(event => event.type === 'recovery.required')).toHaveLength(1)
  await expect(readFile(path.join(root, 'duplicate'))).rejects.toThrow()
  await expect(readFile(path.join(root, 'not-started'))).rejects.toThrow()
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
    ),
  ).toMatchObject({ status: 'limit_reached', reason: 'max_steps' })
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
