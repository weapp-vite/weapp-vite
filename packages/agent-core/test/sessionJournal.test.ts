import { appendFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Session } from '../src/session.js'
import { journal } from './session/helpers.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-journal-'))
  process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')
})
afterEach(async () => {
  delete process.env.WEAPP_AGENT_STATE_DIR
  await rm(root, { recursive: true, force: true })
})

it('does not create state directories or lock files for read-only queries', async () => {
  const session = new Session(root, 'missing')
  expect(await Session.list(root)).toEqual([])
  expect(await Session.listSummaries(root)).toEqual([])
  await expect(Session.inspect(root, session.id)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(stat(session.directory)).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(Session.inspect(root, '../invalid')).rejects.toThrow('Invalid session ID')
})

it('repairs only an incomplete trailing record when resume holds the lock', async () => {
  const session = await journal(root, 'tail', [['message', { message: { role: 'user', text: '中文目标' } }]])
  const complete = await readFile(session.filename)
  await appendFile(session.filename, '{"message":"半行')
  expect((await Session.inspect(root, session.id)).diagnostics).toHaveLength(1)
  await expect(stat(`${session.filename}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
  await session.open(true)
  try {
    expect(await readFile(session.filename)).toEqual(complete)
    expect(session.messages).toEqual([{ role: 'user', text: '中文目标' }])
    const event = await session.append('run.started', { resumed: true })
    expect(event.sequence).toBe(2)
  }
  finally {
    await session.close()
  }
  expect((await Session.inspect(root, session.id)).diagnostics).toEqual([])
})

it('never repairs a tail when a complete record is corrupt', async () => {
  const session = await journal(root, 'corrupt', [])
  await appendFile(session.filename, '{malformed}\npartial')
  const before = await readFile(session.filename)
  await expect(session.open(true)).rejects.toThrow('malformed JSON')
  expect(await readFile(session.filename)).toEqual(before)
  await expect(stat(`${session.filename}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('retains unknown event types and reads legacy messages without origin', async () => {
  const session = await journal(root, 'legacy', [
    ['message', { message: { role: 'user', text: 'original goal' } }],
    ['future.extension', { nested: { anything: true } }],
  ])
  await session.open(true)
  try {
    expect(session.events[1]).toMatchObject({ type: 'future.extension', data: { nested: { anything: true } } })
    expect(session.messages).toEqual([{ role: 'user', text: 'original goal' }])
  }
  finally {
    await session.close()
  }
  expect(await Session.inspect(root, session.id)).toMatchObject({ prompt: 'original goal', status: 'unfinished', diagnostics: [] })
})

it('keeps the legacy allowance for empty lines without changing event sequences', async () => {
  const session = await journal(root, 'empty-lines', [['message', { message: { role: 'user', text: 'goal' } }]])
  const original = await readFile(session.filename, 'utf8')
  await writeFile(session.filename, `\n${original}\n`)
  await session.open(true)
  try {
    expect(session.events).toHaveLength(1)
    expect((await session.append('run.started', {})).sequence).toBe(2)
  }
  finally {
    await session.close()
  }
  expect((await Session.inspect(root, session.id)).status).toBe('unfinished')
})

it.each([
  { version: 2 },
  { sessionId: 'different' },
  { sequence: 2 },
  { timestamp: 'not-a-date' },
  { data: null },
  { data: { message: { role: 'user', text: 123 } } },
  { data: { message: { role: 'user', text: '', origin: 'unknown' } } },
  { data: { message: { role: 'user', text: '', images: [{ type: 'image', data: false }] } } },
  { data: { message: { role: 'assistant', text: '', calls: [{ id: 'a', name: 123 }] } } },
  { data: { message: { role: 'tool', callId: 'a', name: 'tool', result: {} } } },
  { type: 'usage', data: { inputTokens: 'many', outputTokens: 1 } },
  { type: 'run.completed', data: { status: 'running' } },
])('rejects invalid persisted event shapes: %j', async (override) => {
  const session = await journal(root, 'invalid', [])
  await writeFile(session.filename, `${JSON.stringify({
    version: 1,
    sessionId: session.id,
    sequence: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    type: 'message',
    data: { message: { role: 'user', text: 'goal' } },
    ...override,
  })}\n`)
  await expect(session.open(true)).rejects.toThrow('invalid event or message')
  expect((await Session.inspect(root, session.id)).status).toBe('invalid')
})
