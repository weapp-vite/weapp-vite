import type { ModelAdapter, ModelRequest, SessionEvent } from '../src/index.js'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { configSchema, runAgent, Session } from '../src/index.js'
import { createTaskScope } from './taskScope'

let root: string
let tasks: ReturnType<typeof createTaskScope>
beforeEach(async ({ signal }) => {
  tasks = createTaskScope(signal)
  root = await mkdtemp(path.join(tmpdir(), 'weapp-context-'))
  process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')
})
afterEach(async () => {
  await tasks.close()
  delete process.env.WEAPP_AGENT_STATE_DIR
  await rm(root, { recursive: true, force: true })
})

it('stops before contacting the provider when user context exceeds the budget and resumes intact with a larger budget', { timeout: 30_000 }, () => tasks.run(async () => {
  const requests: ModelRequest[] = []
  const model: ModelAdapter = {
    id: 'test',
    async* stream(request) {
      requests.push(request)
      yield { type: 'text', text: 'Continued with the complete request.' }
    },
  }
  const events: SessionEvent[] = []
  const config = configSchema.parse({ model: { provider: 'openai', name: 'test' }, contextCharacters: 8000 })
  const prompt = `${'Original task requirements. '.repeat(350)}Keep this final requirement.`
  const first = await runAgent({
    root,
    config,
    model,
    tools: [],
    prompt,
    signal: tasks.signal,
    onEvent: (event) => { events.push(event) },
  })
  expect(first).toMatchObject({ status: 'limit_reached', reason: 'context_budget' })
  expect(first.text).toContain('Increase contextCharacters')
  expect(requests).toHaveLength(0)
  expect(events.some(event => event.type === 'step.started')).toBe(false)
  expect(events.at(-1)).toMatchObject({ type: 'run.completed', data: { status: 'limit_reached', reason: 'context_budget' } })
  const journal = await readFile(new Session(root, first.sessionId).filename, 'utf8')
  expect(journal).toContain(prompt)

  const resumed = await runAgent({
    root,
    config: { ...config, contextCharacters: 16000 },
    model,
    tools: [],
    prompt: 'Continue without removing any requirements.',
    sessionId: first.sessionId,
    signal: tasks.signal,
  })
  expect(resumed.status).toBe('completed')
  expect(requests).toHaveLength(1)
  expect(requests[0]!.messages).toContainEqual({ role: 'user', origin: 'user', text: prompt })
}))

it('retains legacy requests and later constraints when resuming a long session', { timeout: 30_000 }, () => tasks.run(async () => {
  const session = new Session(root)
  await session.open()
  try {
    await session.append('message', { message: { role: 'user', text: 'Original task: preserve exports and user changes.' } })
    for (let i = 0; i < 12; i++) {
      await session.append('message', { message: { role: 'assistant', text: `Earlier analysis ${i}: ${'x'.repeat(1000)}` } })
    }
    await session.append('message', { message: { role: 'user', origin: 'user', text: 'Additional constraint: do not alter the route.' } })
    await session.append('message', { message: { role: 'user', origin: 'engine', text: 'Internal reminder. '.repeat(1000) } })
  }
  finally {
    await session.close()
  }
  const requests: ModelRequest[] = []
  const model: ModelAdapter = {
    id: 'test',
    async* stream(request) {
      requests.push(request)
      yield { type: 'text', text: 'Ready to continue.' }
    },
  }
  const events: SessionEvent[] = []
  const result = await runAgent({
    root,
    config: configSchema.parse({ model: { provider: 'openai', name: 'test' }, contextCharacters: 8000 }),
    model,
    tools: [],
    prompt: 'Continue.',
    sessionId: session.id,
    signal: tasks.signal,
    onEvent: (event) => { events.push(event) },
  })
  expect(result.status).toBe('completed')
  expect(events.some(event => event.type === 'context.compacted')).toBe(true)
  expect(requests[0]!.messages.filter(message => message.role === 'user' && message.origin !== 'engine')).toEqual([
    { role: 'user', text: 'Original task: preserve exports and user changes.' },
    { role: 'user', origin: 'user', text: 'Additional constraint: do not alter the route.' },
    { role: 'user', origin: 'user', text: 'Continue.' },
  ])
}))
