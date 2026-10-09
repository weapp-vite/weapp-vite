import type { Message } from '../src/types.js'
import { appendFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Session } from '../src/session.js'
import { completed, declared, journal } from './session/helpers.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-session-'))
  process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')
})
afterEach(async () => {
  delete process.env.WEAPP_AGENT_STATE_DIR
  delete process.env.SESSION_TEST_API_KEY
  await rm(root, { recursive: true, force: true })
})

it('keeps a reused call ID pending after its earlier occurrence completed', async () => {
  const session = await journal(root, 'reuse', [
    declared('shared'),
    ['tool.started', { callId: 'shared', name: 'shell' }],
    completed('shared'),
    ['tool.completed', { callId: 'shared', name: 'shell' }],
    declared('shared'),
    ['tool.started', { callId: 'shared', name: 'shell' }],
  ])
  await session.open(true)
  try {
    expect(session.recovery()).toEqual([
      { id: 'shared', name: 'shell', input: { command: 'echo hello' }, state: 'outcome_unknown' },
    ])
    expect(session.unresolved()).toEqual(session.recovery())
  }
  finally {
    await session.close()
  }
})

it('distinguishes declared and started calls, and accepts a persisted result without tool.completed', async () => {
  const session = await journal(root, 'partial', [
    declared('finished', 'started', 'waiting'),
    ['tool.started', { callId: 'finished' }],
    completed('finished'),
    ['tool.started', { callId: 'started' }],
  ])
  await session.open(true)
  try {
    expect(session.recovery().map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'started', state: 'outcome_unknown' },
      { id: 'waiting', state: 'not_executed' },
    ])
  }
  finally {
    await session.close()
  }
  expect((await Session.inspect(root, 'partial')).pendingCalls.map(call => call.id)).toEqual(['started', 'waiting'])
})

it('retains queued inputs and images while projecting them after the complete tool group', async () => {
  const original: Message = { role: 'user', text: 'Original request from a legacy session' }
  const assistant: Message = { role: 'assistant', text: '', calls: [
    { id: 'first', name: 'shell', input: { command: 'first operation' } },
    { id: 'second', name: 'shell', input: { command: 'second operation' } },
  ] }
  const constraint: Message = {
    role: 'user',
    origin: 'user',
    text: 'Preserve the database and match this image',
    images: [{ type: 'image', mediaType: 'image/png', data: 'reference-image' }],
  }
  const followup: Message = { role: 'user', text: 'Preserve public exports as well' }
  const reminder: Message = { role: 'user', origin: 'engine', text: 'Inspect before continuing' }
  const firstResult: Message = { role: 'tool', callId: 'first', name: 'shell', result: { text: 'First result' } }
  const secondResult: Message = { role: 'tool', callId: 'second', name: 'shell', result: { text: 'Second result' } }
  const rawMessages = [original, assistant, constraint, firstResult, followup, reminder]
  const session = await journal(root, 'queued-inputs', rawMessages.map(message => ['message', { message }]))
  await session.open(true)
  try {
    expect(session.messages).toEqual([original, assistant, firstResult, constraint, followup, reminder])
    expect(session.recovery().map(call => call.id)).toEqual(['second'])
    expect(await Session.inspect(root, session.id)).toMatchObject({ prompt: followup.text })
  }
  finally {
    await session.close()
  }

  const resumed = new Session(root, session.id)
  await resumed.open(true)
  const projected = [original, assistant, firstResult, secondResult, constraint, followup, reminder]
  try {
    expect(resumed.messages).toEqual(session.messages)
    await resumed.append('message', { message: secondResult })
    expect(resumed.messages).toEqual(projected)
    expect(resumed.recovery()).toEqual([])
    expect(resumed.events.filter(event => event.type === 'message').map(event => event.data.message))
      .toEqual([...rawMessages, secondResult])
  }
  finally {
    await resumed.close()
  }

  const reopened = new Session(root, session.id)
  await reopened.open(true)
  try {
    expect(reopened.messages).toEqual(projected)
  }
  finally {
    await reopened.close()
  }
})

it('defers inputs only for the current occurrence of a reused call ID', async () => {
  const firstConstraint: Message = { role: 'user', text: 'Preserve the first completed change' }
  const betweenRuns: Message = { role: 'user', text: 'Start the second change' }
  const secondConstraint: Message = { role: 'user', origin: 'user', text: 'Inspect the second change before continuing' }
  const session = await journal(root, 'queued-reused-id', [
    declared('shared'),
    ['message', { message: firstConstraint }],
    completed('shared'),
    ['message', { message: betweenRuns }],
    declared('shared'),
    ['message', { message: secondConstraint }],
  ])
  await session.open(true)
  try {
    const initial = session.messages
    expect(initial.at(-1)).toEqual(secondConstraint)
    expect(initial[2]).toEqual(firstConstraint)
    expect(initial[3]).toEqual(betweenRuns)
    expect(session.recovery().map(call => call.id)).toEqual(['shared'])
    const [type, data] = completed('shared')
    await session.append(type, data)
    expect(session.messages).toEqual([...initial.slice(0, -1), data.message, secondConstraint])
    expect(session.recovery()).toEqual([])
  }
  finally {
    await session.close()
  }
})

it('refuses an orphan result instead of letting it resolve a future declaration with the same ID', async () => {
  const session = await journal(root, 'orphan', [completed('later'), declared('later')])
  await expect(session.open(true)).rejects.toThrow('no preceding pending call')
  expect(await Session.inspect(root, 'orphan')).toMatchObject({ status: 'invalid', diagnostics: [expect.stringContaining('no preceding pending call')] })
})

it('rejects ambiguous simultaneous IDs before recovery and releases only its acquired lock', async () => {
  const session = await journal(root, 'ambiguous', [declared('same'), declared('same'), completed('same')])
  await expect(session.open(true)).rejects.toThrow('multiple unresolved tool calls share an ID')
  await expect(stat(`${session.filename}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
  const summary = await Session.inspect(root, 'ambiguous')
  expect(summary.status).toBe('invalid')
  expect(summary.diagnostics[0]).toContain('Ambiguous')
})

it('reads an active journal and incomplete tail without touching the file or lock', async () => {
  const session = new Session(root, 'active')
  await session.open()
  try {
    await session.append('run.started', { model: 'test' })
    await session.append('message', { message: { role: 'user', text: '保留完整目标' } })
    await appendFile(session.filename, '{"unfinished":')
    const before = await readFile(session.filename)
    const lockBefore = await readFile(`${session.filename}.lock`)
    const summary = await Session.inspect(root, session.id)
    expect(summary.status).toBe('unfinished')
    expect(summary.prompt).toBe('保留完整目标')
    expect(summary.diagnostics[0]).toContain('incomplete trailing')
    expect(await readFile(session.filename)).toEqual(before)
    expect(await readFile(`${session.filename}.lock`)).toEqual(lockBefore)
    expect(await Session.listSummaries(root)).toEqual([summary])
  }
  finally {
    await session.close()
  }
})

it('preserves latest user intent and reports only the last run counters and reason', async () => {
  await journal(root, 'summary', [
    ['run.started', {}],
    ['message', { message: { role: 'user', text: 'legacy original goal' } }],
    ['step.started', { step: 1 }],
    ['usage', { inputTokens: 100, outputTokens: 200 }],
    ['run.completed', { status: 'completed' }],
    ['run.started', {}],
    ['message', { message: { role: 'user', origin: 'user', text: 'new user constraint', images: [{ type: 'image', data: 'private-image', mediaType: 'image/png' }] } }],
    ['message', { message: { role: 'user', origin: 'engine', text: 'verify before finishing' } }],
    ['step.started', { step: 1 }],
    ['usage', { inputTokens: 10, outputTokens: 20 }],
    ['step.started', { step: 2 }],
    ['usage', { inputTokens: 30, outputTokens: 40 }],
    ['run.completed', { status: 'limit_reached', reason: 'context_budget' }],
  ])
  expect(await Session.inspect(root, 'summary')).toEqual({
    sessionId: 'summary',
    updatedAt: '2026-01-01T00:00:00.000Z',
    prompt: 'new user constraint',
    status: 'limit_reached',
    reason: 'context_budget',
    steps: 2,
    usage: { inputTokens: 40, outputTokens: 60 },
    pendingCalls: [],
    diagnostics: [],
  })
})

it('redacts old unredacted logs and excludes images and binary data from details', async () => {
  process.env.SESSION_TEST_API_KEY = 'private-session-secret'
  await journal(root, 'private', [
    ['message', { message: { role: 'user', text: 'inspect private-session-secret', images: [{ type: 'image', data: 'user-image-bytes', mediaType: 'image/png' }] } }],
    ['message', { message: { role: 'assistant', text: '', calls: [{
      id: 'image',
      name: 'inspect',
      input: {
        token: 'an-unknown-token',
        command: 'echo private-session-secret',
        images: [{ type: 'image', data: 'call-image-bytes', mediaType: 'image/png' }],
        inline: 'data:image/png;base64,aW1hZ2VieXRlcw==',
        blob: 'a'.repeat(128),
        nested: { type: 'image', data: 'nested-image-bytes' },
      },
    }] } }],
  ])
  const summary = await Session.inspect(root, 'private')
  const displayed = JSON.stringify(summary)
  for (const secret of ['private-session-secret', 'an-unknown-token', 'user-image-bytes', 'call-image-bytes', 'nested-image-bytes', 'aW1hZ2VieXRlcw==', 'a'.repeat(128)]) {
    expect(displayed).not.toContain(secret)
  }
  expect(summary.prompt).toBe('inspect [REDACTED]')
  expect(displayed).toContain('image')
})

it('lists details newest first, preserving invalid entries and legacy ID arrays', async () => {
  await journal(root, 'older', [['run.completed', { status: 'completed' }]], '2026-01-01T00:00:00.000Z')
  await journal(root, 'newer-a', [['run.started', {}]], '2026-02-01T00:00:00.000Z')
  const newest = await journal(root, 'newer-b', [['run.started', {}]], '2026-02-01T00:00:00.000Z')
  const bad = await journal(root, 'bad', [])
  await appendFile(bad.filename, '{bad-json}\n')
  const summaries = await Session.listSummaries(root)
  expect(summaries.map(summary => summary.sessionId)).toEqual(['newer-a', newest.id, 'older', 'bad'])
  expect(summaries.at(-1)).toMatchObject({ status: 'invalid', diagnostics: [expect.stringContaining('malformed JSON')] })
  expect((await Session.list(root)).sort()).toEqual(['bad', 'newer-a', 'newer-b', 'older'])
})

it('sorts event timestamps by instant even when their UTC offsets differ', async () => {
  await journal(root, 'later', [['run.started', {}]], '2026-01-01T00:30:00.000Z')
  await journal(root, 'earlier', [['run.started', {}]], '2026-01-01T01:00:00.000+01:00')
  expect((await Session.listSummaries(root)).map(summary => summary.sessionId)).toEqual(['later', 'earlier'])
})
