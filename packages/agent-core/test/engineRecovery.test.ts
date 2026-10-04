import type { ImageInput, Message, ModelAdapter, ModelRequest } from '../src/index.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { configSchema, runAgent, Session } from '../src/index.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-recovery-input-'))
  process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')
})
afterEach(async () => {
  delete process.env.WEAPP_AGENT_STATE_DIR
  await rm(root, { recursive: true, force: true })
})

async function interruptedSession(): Promise<Session> {
  const session = new Session(root)
  await session.open()
  try {
    await session.append('message', { message: { role: 'user', text: 'Original goal: update the page.' } })
    await session.append('message', { message: {
      role: 'assistant',
      text: '',
      calls: [
        { id: 'finished', name: 'read_file', input: { path: 'page.ts' } },
        { id: 'started', name: 'shell', input: { command: 'update' } },
        { id: 'queued', name: 'create_file', input: { path: 'new.ts', content: '' } },
      ],
    } })
    await session.append('message', { message: { role: 'tool', name: 'read_file', callId: 'finished', result: { text: 'page contents' } } })
    await session.append('tool.started', { name: 'shell', callId: 'started', mutates: true })
  }
  finally {
    await session.close()
  }
  return session
}

function recordingModel() {
  const requests: ModelRequest[] = []
  const model: ModelAdapter = {
    id: 'test',
    async* stream(request) {
      requests.push(request)
      yield { type: 'text', text: 'Requirements received.' }
    },
  }
  return { requests, model }
}

it('persists blocked follow-ups and images once, then delivers them after the interrupted tool group', async () => {
  const session = await interruptedSession()
  const { model, requests } = recordingModel()
  const config = configSchema.parse({ model: { provider: 'openai', name: 'test' } })
  const image: ImageInput = { type: 'image', mediaType: 'image/png', data: 'reference-image' }
  const prompts = ['Keep all public exports unchanged.', 'Only update colors to match this screenshot.']
  for (const [index, prompt] of prompts.entries()) {
    const result = await runAgent({ root, config, model, tools: [], prompt, images: index ? [image] : undefined, sessionId: session.id })
    expect(result.status).toBe('action_required')
    expect(requests).toHaveLength(0)
    expect(await Session.inspect(root, session.id)).toMatchObject({ prompt, pendingCalls: [
      expect.objectContaining({ id: 'started', state: 'outcome_unknown' }),
      expect.objectContaining({ id: 'queued', state: 'not_executed' }),
    ] })
  }
  const expected: Message[] = [
    { role: 'user', text: 'Original goal: update the page.' },
    { role: 'user', origin: 'user', text: prompts[0]! },
    { role: 'user', origin: 'user', text: prompts[1]!, images: [image] },
    { role: 'user', origin: 'user', text: 'I inspected the tool outcomes. Continue.' },
  ]
  const resumed = await runAgent({
    root,
    config,
    model,
    tools: [],
    sessionId: session.id,
    prompt: 'I inspected the tool outcomes. Continue.',
    acknowledgeInterrupted: true,
  })
  expect(resumed.status).toBe('completed')
  expect(requests).toHaveLength(1)
  expect(requests[0]!.messages.filter(message => message.role === 'user')).toEqual(expected)
  expect(requests[0]!.messages.slice(1, 5).map(message => message.role)).toEqual(['assistant', 'tool', 'tool', 'tool'])
  expect(await Session.inspect(root, session.id)).toMatchObject({ pendingCalls: [] })

  await runAgent({ root, config, model, tools: [], sessionId: session.id, prompt: 'Next follow-up.' })
  expect(requests).toHaveLength(2)
  expect(requests[1]!.messages.filter(message => message.role === 'user')).toEqual([
    ...expected,
    { role: 'user', origin: 'user', text: 'Next follow-up.' },
  ])
})

it('keeps oversized blocked requirements and applies their budget before the first model request after acknowledgement', async () => {
  const session = await interruptedSession()
  const { model, requests } = recordingModel()
  const config = configSchema.parse({ model: { provider: 'openai', name: 'test' }, contextCharacters: 8000 })
  const prompt = `${'Do not remove any requirements. '.repeat(300)}Keep the final constraint.`
  expect((await runAgent({ root, config, model, tools: [], sessionId: session.id, prompt })).status).toBe('action_required')
  const blocked = await runAgent({
    root,
    config,
    model,
    tools: [],
    sessionId: session.id,
    prompt: 'I inspected the outcomes.',
    acknowledgeInterrupted: true,
  })
  expect(blocked).toMatchObject({ status: 'limit_reached', reason: 'context_budget' })
  expect(requests).toHaveLength(0)
  const continued = await runAgent({
    root,
    config: { ...config, contextCharacters: 20000 },
    model,
    tools: [],
    sessionId: session.id,
    prompt: 'Continue with a larger budget.',
  })
  expect(continued.status).toBe('completed')
  expect(requests[0]!.messages).toContainEqual({ role: 'user', origin: 'user', text: prompt })
})
