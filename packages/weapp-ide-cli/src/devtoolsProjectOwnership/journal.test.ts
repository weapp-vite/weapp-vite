import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { mutateLease } from '@weapp-vite/devtools-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withManagedJournalLock } from './journal'

const mocks = vi.hoisted(() => ({ identity: vi.fn() }))
vi.mock('./host', async importOriginal => ({
  ...await importOriginal<typeof import('./host')>(),
  readManagedProcessIdentity: mocks.identity,
}))

const writer = { pid: process.pid, executable: 'journal-writer', started: 'current-generation' }
let directory: string
let lock: string

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-journal-lock-'))
  lock = path.join(directory, '.ownership-lock')
  mocks.identity.mockResolvedValue(writer)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

async function writeOwner(owner: { token: string, identity: typeof writer }) {
  await fs.mkdir(lock, { recursive: true })
  await fs.writeFile(path.join(lock, 'owner'), JSON.stringify(owner))
}

describe('managed journal lock ownership', () => {
  it('preserves a replacement lock installed while the previous owner identity is inspected', async () => {
    const previous = { token: randomUUID(), identity: { ...writer, pid: process.pid + 1, started: 'previous-generation' } }
    const replacement = { token: randomUUID(), identity: { ...writer, pid: process.pid + 2, started: 'replacement-generation' } }
    const stop = new Error('replacement remains owned')
    await writeOwner(previous)
    mocks.identity.mockImplementation(async (pid: number) => {
      if (pid === previous.identity.pid) {
        // 固定旧持有者释放、新持有者获取、旧身份查询返回的交错顺序。
        await fs.rm(lock, { recursive: true })
        await writeOwner(replacement)
        return undefined
      }
      if (pid === replacement.identity.pid) {
        throw stop
      }
      return writer
    })
    const run = vi.fn(async () => 'must remain outside the lock')
    await expect(withManagedJournalLock(directory, run)).rejects.toBe(stop)
    expect(run).not.toHaveBeenCalled()
    expect(JSON.parse(await fs.readFile(path.join(lock, 'owner'), 'utf8'))).toEqual(replacement)
  })

  it('serializes concurrent callers across asynchronous critical sections', async () => {
    let active = 0
    let maximum = 0
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => withManagedJournalLock(directory, async () => {
      active += 1
      maximum = Math.max(maximum, active)
      await setTimeout(5)
      active -= 1
      return index
    })))
    expect(results).toEqual(Array.from({ length: 12 }, (_, index) => index))
    expect(maximum).toBe(1)
    await expect(fs.access(lock)).rejects.toThrow()
    await expect(fs.access(`${lock}.recovery`)).rejects.toThrow()
  })

  it('waits for an ongoing ownership mutation before acquiring the journal', async () => {
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const mutation = mutateLease(lock, async () => {
      entered.resolve()
      await release.promise
    })
    await entered.promise
    const run = vi.fn(async () => 'acquired')
    const operation = withManagedJournalLock(directory, run)
    try {
      await setTimeout(30)
      expect(run).not.toHaveBeenCalled()
      await expect(fs.access(lock)).rejects.toThrow()
    }
    finally {
      release.resolve()
      await mutation
      await operation
    }
    expect(run).toHaveBeenCalledOnce()
  })

  it('waits for an ongoing ownership mutation before releasing the journal', async () => {
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const finished = vi.fn()
    let mutation: Promise<void> | undefined
    const operation = withManagedJournalLock(directory, async () => {
      mutation = mutateLease(lock, async () => {
        entered.resolve()
        await release.promise
      })
      await entered.promise
    }).then(finished)
    await entered.promise
    try {
      await setTimeout(30)
      expect(finished).not.toHaveBeenCalled()
      expect((await fs.stat(lock)).isDirectory()).toBe(true)
    }
    finally {
      release.resolve()
      await mutation
      await operation
    }
    expect(finished).toHaveBeenCalledOnce()
    await expect(fs.access(lock)).rejects.toThrow()
  })

  it('refuses to release a replacement token and leaves its lock intact', async () => {
    const replacement = { token: randomUUID(), identity: writer }
    await expect(withManagedJournalLock(directory, async () => {
      await writeOwner(replacement)
    })).rejects.toThrow('lock ownership changed')
    expect(JSON.parse(await fs.readFile(path.join(lock, 'owner'), 'utf8'))).toEqual(replacement)
  })

  it('preserves an incomplete lock without running the critical section', async () => {
    await fs.mkdir(lock)
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(45_000)
    const run = vi.fn(async () => undefined)
    await expect(withManagedJournalLock(directory, run)).rejects.toThrow('still owned by another operation')
    expect(run).not.toHaveBeenCalled()
    expect((await fs.stat(lock)).isDirectory()).toBe(true)
  })
})
