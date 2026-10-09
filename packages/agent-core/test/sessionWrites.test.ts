import { mkdir, mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Session } from '../src/session.js'
import { readSessionJournal } from '../src/session/reader.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-session-writes-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('requires an owned open session before writing and rejects a second open on the same instance', async () => {
  const session = new Session(root, 'owned', root)
  await expect(session.append('message', { message: { role: 'user', text: 'not accepted' } })).rejects.toThrow('must be open')
  await expect(stat(session.filename)).rejects.toMatchObject({ code: 'ENOENT' })
  await session.open()
  try {
    await expect(session.open(true)).rejects.toThrow('already open')
    const contender = new Session(root, session.id, root)
    await expect(contender.open(true)).rejects.toThrow('already active')
    await contender.close()
    expect(await readFile(`${session.filename}.lock`, 'utf8')).toMatch(/^\d+$/)
    await session.append('message', { message: { role: 'user', text: 'accepted' } })
  }
  finally {
    await session.close()
  }
  const before = await readFile(session.filename)
  await expect(session.append('run.started', {})).rejects.toThrow('must be open')
  expect(await readFile(session.filename)).toEqual(before)
})

it('serializes concurrent appends and drains accepted writes before releasing ownership', async () => {
  const session = new Session(root, 'queued', root)
  await session.open()
  const writes = Array.from({ length: 24 }, (_, index) => session.append('message', {
    message: { role: 'user', text: `${index}: ${'完整记录'.repeat(512)}` },
  }))
  const close = session.close()
  expect(session.close()).toBe(close)
  await expect(session.append('run.started', {})).rejects.toThrow('must be open')
  const events = await Promise.all(writes)
  await close
  const journal = await readSessionJournal(session.filename, session.id)
  expect(journal.events).toEqual(events)
  expect(journal.events.map(event => event.sequence)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1))
  expect(journal.incompleteTail).toBe(false)
  expect(session.events).toEqual(journal.events)
  await session.open(true)
  try {
    expect((await session.append('run.started', {})).sequence).toBe(25)
  }
  finally {
    await session.close()
  }
})

it('rejects all later appends after a write failure until the journal has been reopened and validated', async () => {
  const session = new Session(root, 'failed-write', root)
  await session.open()
  await session.append('run.started', {})
  const saved = `${session.filename}.saved`
  await rename(session.filename, saved)
  await mkdir(session.filename)
  try {
    await expect(session.append('message', { message: { role: 'user', text: 'not persisted' } })).rejects.toThrow()
    await rm(session.filename, { recursive: true })
    await rename(saved, session.filename)
    await expect(session.append('run.completed', { status: 'completed' })).rejects.toThrow()
    expect((await readSessionJournal(session.filename, session.id)).events).toHaveLength(1)
    await expect(session.close()).rejects.toThrow()
    await expect(stat(`${session.filename}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
    await session.open(true)
    expect((await session.append('run.started', {})).sequence).toBe(2)
  }
  finally {
    await session.close()
  }
})
