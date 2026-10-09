import fs, { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mutateLease } from '../src/lease/directory'

const platform = vi.hoisted(() => ({ value: 'win32' as NodeJS.Platform }))

vi.mock('node:process', async (original) => {
  const actual = await original<{ default: NodeJS.Process }>()
  return {
    ...actual,
    default: {
      ...actual.default,
      get platform() { return platform.value },
    },
  }
})

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, mkdir: vi.fn(actual.mkdir), rm: vi.fn(actual.rm) }
})

vi.mock('node:timers/promises', async (original) => {
  const actual = await original<typeof import('node:timers/promises')>()
  return { ...actual, setTimeout: vi.fn(actual.setTimeout) }
})

let directory: string
let lock: string
let guard: string

beforeEach(async () => {
  platform.value = 'win32'
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lease-mutation-windows-'))
  lock = path.join(directory, 'lock')
  guard = `${lock}.recovery`
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(mkdir).mockReset()
  vi.mocked(rm).mockReset()
  vi.mocked(setTimeout).mockReset()
  await fs.rm(directory, { recursive: true, force: true })
})

function filesystemError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`Injected mkdir failure: ${code}`), { code })
}

function controlledRetryClock(timeoutMs: number) {
  let now = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.mocked(setTimeout).mockImplementation(async <T = void>(delay = 1, value?: T) => {
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBeLessThanOrEqual(timeoutMs - now)
    now += delay
    return value as T
  })
  return () => now
}

it('retries one Windows EPERM without overlapping the current guard owner', async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const injected = Promise.withResolvers<void>()
  const retry = Promise.withResolvers<void>()
  const failure = filesystemError('EPERM')
  let active = 0
  let maximumActive = 0
  let outcomes: PromiseSettledResult<string>[] = []
  const first = mutateLease(lock, async () => {
    active++
    maximumActive = Math.max(maximumActive, active)
    entered.resolve()
    try {
      await release.promise
      return 'first'
    }
    finally {
      active--
    }
  })
  let settled: Promise<PromiseSettledResult<string>[]> = Promise.allSettled([first])
  const run = vi.fn(async () => {
    active++
    maximumActive = Math.max(maximumActive, active)
    try {
      return 'second'
    }
    finally {
      active--
    }
  })
  try {
    await entered.promise
    vi.mocked(mkdir).mockImplementationOnce(async () => {
      injected.resolve()
      throw failure
    })
    vi.mocked(setTimeout).mockImplementation(async <T = void>(_delay?: number, value?: T) => {
      await retry.promise
      return value as T
    })
    const second = mutateLease(lock, run, { timeoutMs: 2_000 })
    // 立即登记两个结果，原实现提前拒绝时也不会产生未处理的 Promise。
    settled = Promise.allSettled([first, second])
    await injected.promise
    expect(run).not.toHaveBeenCalled()
    expect((await fs.stat(guard)).isDirectory()).toBe(true)
    expect(active).toBe(1)
    expect(rm).not.toHaveBeenCalled()
  }
  finally {
    release.resolve()
    await Promise.allSettled([first])
    retry.resolve()
    outcomes = await settled
  }
  expect(outcomes).toEqual([
    { status: 'fulfilled', value: 'first' },
    { status: 'fulfilled', value: 'second' },
  ])
  expect(run).toHaveBeenCalledOnce()
  expect(maximumActive).toBe(1)
  expect(active).toBe(0)
  await expect(fs.access(guard)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('bounds persistent Windows EPERM retries and preserves the original error', async () => {
  const failure = filesystemError('EPERM')
  const now = controlledRetryClock(25)
  vi.mocked(mkdir).mockRejectedValue(failure)
  const run = vi.fn(async () => undefined)

  await expect(mutateLease(lock, run, { timeoutMs: 25 })).rejects.toBe(failure)

  expect(now()).toBe(25)
  expect(mkdir).toHaveBeenCalledTimes(4)
  expect(setTimeout).toHaveBeenCalledTimes(3)
  expect(run).not.toHaveBeenCalled()
  expect(rm).not.toHaveBeenCalled()
})

it('does not wait or mutate ownership for Windows EPERM with a zero timeout', async () => {
  const failure = filesystemError('EPERM')
  vi.mocked(mkdir).mockRejectedValue(failure)
  const run = vi.fn(async () => undefined)

  await expect(mutateLease(lock, run, { timeoutMs: 0 })).rejects.toBe(failure)

  expect(mkdir).toHaveBeenCalledOnce()
  expect(setTimeout).not.toHaveBeenCalled()
  expect(run).not.toHaveBeenCalled()
  expect(rm).not.toHaveBeenCalled()
})

it.each([
  ['linux', 'EPERM'],
  ['darwin', 'EPERM'],
  ['win32', 'EACCES'],
  ['win32', 'EIO'],
] as const)('propagates %s %s immediately', async (osPlatform, code) => {
  platform.value = osPlatform
  const failure = filesystemError(code)
  vi.mocked(mkdir).mockRejectedValue(failure)
  const run = vi.fn(async () => undefined)

  await expect(mutateLease(lock, run, { timeoutMs: 25 })).rejects.toBe(failure)

  expect(mkdir).toHaveBeenCalledOnce()
  expect(setTimeout).not.toHaveBeenCalled()
  expect(run).not.toHaveBeenCalled()
  expect(rm).not.toHaveBeenCalled()
})

it.each(['EEXIST', 'EPERM'])('retains a foreign guard after %s exhausts the budget', async (code) => {
  await fs.mkdir(guard)
  const marker = path.join(guard, 'foreign-owner')
  await fs.writeFile(marker, 'preserve')
  const failure = filesystemError(code)
  const now = controlledRetryClock(25)
  vi.mocked(mkdir).mockRejectedValue(failure)
  const run = vi.fn(async () => undefined)
  const result = mutateLease(lock, run, { timeoutMs: 25 })

  if (code === 'EPERM') {
    await expect(result).rejects.toBe(failure)
  }
  else {
    await expect(result).rejects.toThrow('recovery is in progress')
  }
  expect(now()).toBe(25)
  expect(run).not.toHaveBeenCalled()
  expect(rm).not.toHaveBeenCalled()
  expect(await fs.readFile(marker, 'utf8')).toBe('preserve')
})

it('preserves callback failure while releasing only its acquired guard', async () => {
  const foreignGuard = path.join(directory, 'foreign.recovery')
  await fs.mkdir(foreignGuard)
  const failure = new Error('callback failed')

  await expect(mutateLease(lock, async () => {
    throw failure
  })).rejects.toBe(failure)

  expect(rm).toHaveBeenCalledExactlyOnceWith(guard, { recursive: true })
  await expect(fs.access(guard)).rejects.toMatchObject({ code: 'ENOENT' })
  expect((await fs.stat(foreignGuard)).isDirectory()).toBe(true)
})

it('propagates guard release failure after a successful callback', async () => {
  const failure = filesystemError('EPERM')
  vi.mocked(rm).mockRejectedValueOnce(failure)
  const run = vi.fn(async () => 'completed')

  await expect(mutateLease(lock, run)).rejects.toBe(failure)

  expect(run).toHaveBeenCalledOnce()
  expect(rm).toHaveBeenCalledExactlyOnceWith(guard, { recursive: true })
  expect(setTimeout).not.toHaveBeenCalled()
  expect((await fs.stat(guard)).isDirectory()).toBe(true)
})
