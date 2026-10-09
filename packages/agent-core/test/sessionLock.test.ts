import type { SessionLock } from '../src/session/lock.js'
import { execFile } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { acquireSessionLock } from '../src/session/lock.js'

let root: string
let filename: string
let owned: SessionLock[]

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-session-lock-'))
  filename = path.join(root, 'session.jsonl')
  owned = []
})

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.allSettled(owned.map(lock => lock.release()))
  await rm(root, { recursive: true, force: true })
})

async function acquire(file = filename): Promise<SessionLock> {
  const lock = await acquireSessionLock(file)
  owned.push(lock)
  return lock
}

async function exitedPid(): Promise<number> {
  const { stdout } = await promisify(execFile)(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'])
  const pid = Number(stdout)
  expect(() => process.kill(pid, 0)).toThrowError(expect.objectContaining({ code: 'ESRCH' }))
  return pid
}

it('allows exactly one concurrent stale-lock recovery and preserves another session', async () => {
  const otherFile = path.join(root, 'other.jsonl')
  const other = await acquire(otherFile)
  await writeFile(`${filename}.lock`, String(await exitedPid()))
  const outcomes = await Promise.allSettled(Array.from({ length: 16 }, () => acquire()))
  const winners = outcomes.filter(outcome => outcome.status === 'fulfilled')
  expect(winners).toHaveLength(1)
  expect(await readFile(`${filename}.lock`, 'utf8')).toBe(String(process.pid))
  await expect(owned.find(lock => lock !== other)!.assertOwned()).resolves.toBeUndefined()
  await expect(other.assertOwned()).resolves.toBeUndefined()
  await expect(lstat(`${filename}.lock.reclaim`)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('preserves a live legacy PID owner and removes only its own recovery guard', async () => {
  await writeFile(`${filename}.lock`, `${process.pid}\n`)
  await expect(acquire()).rejects.toThrow('already active')
  expect(await readFile(`${filename}.lock`, 'utf8')).toBe(`${process.pid}\n`)
  await expect(lstat(`${filename}.lock.reclaim`)).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each(['', 'unknown', '-1', '0', '1.5', '9007199254740992'])('does not reclaim an invalid owner %j', async (owner) => {
  await writeFile(`${filename}.lock`, owner)
  await expect(acquire()).rejects.toThrow('invalid')
  expect(await readFile(`${filename}.lock`, 'utf8')).toBe(owner)
})

it('does not reclaim a lock when the owner cannot be inspected', async () => {
  await writeFile(`${filename}.lock`, String(process.pid))
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('Permission denied'), { code: 'EPERM' })
  })
  await expect(acquire()).rejects.toMatchObject({ code: 'EPERM' })
  expect(await readFile(`${filename}.lock`, 'utf8')).toBe(String(process.pid))
})

it.each([false, true])('never takes over an unknown recovery guard, with an old lock: %s', async (hasLock) => {
  await mkdir(`${filename}.lock.reclaim`)
  if (hasLock) {
    await writeFile(`${filename}.lock`, String(await exitedPid()))
  }
  await expect(acquire()).rejects.toThrow('inspect the recovery guard')
  expect((await lstat(`${filename}.lock.reclaim`)).isDirectory()).toBe(true)
  if (!hasLock) {
    await expect(lstat(`${filename}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
  }
})

it('rejects a non-file owner without deleting it', async () => {
  await mkdir(`${filename}.lock`)
  await expect(acquire()).rejects.toThrow('not a regular file')
  expect((await lstat(`${filename}.lock`)).isDirectory()).toBe(true)
})

it('releases once and never deletes a replacement owner', async () => {
  const first = await acquire()
  await rename(`${filename}.lock`, path.join(root, 'previous.lock'))
  const second = await acquire()
  await expect(first.assertOwned()).rejects.toThrow('ownership was lost')
  await Promise.all([first.release(), first.release()])
  await expect(second.assertOwned()).resolves.toBeUndefined()
  expect(await readFile(`${filename}.lock`, 'utf8')).toBe(String(process.pid))
  await second.release()
  await first.release()
  await expect(lstat(`${filename}.lock`)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('treats an already missing owned lock as released', async () => {
  const lock = await acquire()
  await unlink(`${filename}.lock`)
  await expect(lock.assertOwned()).rejects.toThrow('ownership was lost')
  await Promise.all([lock.release(), lock.release()])
  await expect(lock.assertOwned()).rejects.toThrow('ownership was lost')
})
