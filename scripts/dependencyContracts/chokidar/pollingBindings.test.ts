import type { BigIntStats, Stats } from 'node:fs'
import fs from 'node:fs'
import promises from 'node:fs/promises'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

interface Subscription { close: () => Promise<void> }
interface Scheduler {
  now: () => number
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}
interface Backend {
  setPollingListener: (
    file: string,
    fullPath: string,
    options: { interval: number, persistent: boolean },
    scheduler: Scheduler,
    handlers: { publish: (value: unknown) => void, rawEmitter: (...args: unknown[]) => void, errHandler: (error: unknown) => void },
    initialStats: Stats | BigIntStats,
    signal: AbortSignal,
  ) => Subscription | undefined
}

const require = createRequire(import.meta.url)
const backendUrl = pathToFileURL(path.join(path.dirname(require.resolve('chokidar')), 'backend.js')).href
const { setPollingListener } = await import(backendUrl) as Backend
const file = path.resolve('polling-bindings', 'shared.json')
const otherFile = path.resolve('polling-bindings', 'other.json')
const values = new Map<string, Stats>()
const subscriptions: Subscription[] = []
let scheduler: Scheduler
const isDirectory = () => false

function stats(size: number) {
  return { size, mtimeMs: size, ctimeMs: size, ino: 1, isDirectory } as Stats
}

function owner(interval: number, persistent = true, target = file, initialStats: Stats | BigIntStats = stats(2)) {
  const publish = vi.fn()
  const raw = vi.fn()
  const error = vi.fn()
  const subscription = setPollingListener(target, target, { interval, persistent }, scheduler, { publish, rawEmitter: raw, errHandler: error }, initialStats, new AbortController().signal)!
  subscriptions.push(subscription)
  return { close: subscription.close, publish, raw, error }
}

beforeEach(() => {
  vi.useFakeTimers()
  values.set(file, stats(2))
  values.set(otherFile, stats(2))
  vi.spyOn(promises, 'stat').mockImplementation((async (target: string) => values.get(String(target))!) as typeof promises.stat)
  vi.spyOn(fs, 'watchFile')
  vi.spyOn(fs, 'unwatchFile')
  syncBuiltinESMExports()
  scheduler = { now: () => Date.now(), setTimeout, clearTimeout }
})

afterEach(async () => {
  await Promise.all(subscriptions.splice(0).map(subscription => subscription.close()))
  expect(vi.getTimerCount()).toBe(0)
  values.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
  syncBuiltinESMExports()
})

it.each([false, true])('shares one polling timer and preserves survivors after closing the upgrader first (%s)', async (closeUpgrader) => {
  const slow = owner(120, false)
  const fast = owner(100)
  const sibling = owner(160)
  const other = owner(80, true, otherFile)
  expect(vi.getTimerCount()).toBe(2)
  values.set(file, stats(20))
  await vi.advanceTimersByTimeAsync(100)
  for (const subscriber of [slow, fast, sibling]) {
    expect(subscriber.publish).toHaveBeenCalledOnce()
    expect(subscriber.raw).toHaveBeenLastCalledWith('change', file, { current: stats(20), previous: stats(2) })
  }
  const first = closeUpgrader ? fast : slow
  const survivor = closeUpgrader ? slow : fast
  const closing = first.close()
  expect(first.close()).toBe(closing)
  await closing
  values.set(file, stats(40))
  await vi.advanceTimersByTimeAsync(120)
  expect(first.publish).toHaveBeenCalledOnce()
  expect(survivor.publish).toHaveBeenCalledTimes(2)
  expect(sibling.publish).toHaveBeenCalledTimes(2)
  await survivor.close()
  await sibling.close()
  expect(vi.getTimerCount()).toBe(1)
  values.set(file, stats(60))
  values.set(otherFile, stats(80))
  await vi.advanceTimersByTimeAsync(160)
  expect(sibling.publish).toHaveBeenCalledTimes(2)
  expect(other.publish).toHaveBeenLastCalledWith(expect.objectContaining({ resource: otherFile, current: stats(80) }))
  expect(fs.watchFile).not.toHaveBeenCalled()
  expect(fs.unwatchFile).not.toHaveBeenCalled()
})

it('selects the fastest active interval and updates persistence without adding polling resources', async () => {
  const slow = owner(120, false)
  const persistent = owner(160, true)
  const fast = owner(40, false)
  expect(vi.getTimerCount()).toBe(1)
  values.set(file, stats(20))
  await vi.advanceTimersByTimeAsync(40)
  expect(slow.publish).toHaveBeenCalledOnce()
  expect(persistent.publish).toHaveBeenCalledOnce()
  await fast.close()
  values.set(file, stats(40))
  await vi.advanceTimersByTimeAsync(119)
  expect(slow.publish).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1)
  expect(slow.publish).toHaveBeenCalledTimes(2)
})

it('waits for the exact in-flight stat before completing the final close and publishes nothing after close', async () => {
  const existing = owner(100)
  const read = Promise.withResolvers<Stats>()
  vi.mocked(promises.stat).mockReturnValueOnce(read.promise as ReturnType<typeof promises.stat>)
  await vi.advanceTimersByTimeAsync(100)
  let closed = false
  const closing = existing.close().then(() => {
    closed = true
  })
  await Promise.resolve()
  expect(closed).toBe(false)
  read.resolve(stats(20))
  await closing
  expect(existing.publish).not.toHaveBeenCalled()
  expect(existing.raw).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('preserves a stat error identity for all owners and resumes subsequent observations', async () => {
  const slow = owner(120)
  const fast = owner(100)
  const original = Object.assign(new Error('exact polling stat failure'), { code: 'EACCES' })
  vi.mocked(promises.stat).mockRejectedValueOnce(original)
  await vi.advanceTimersByTimeAsync(100)
  expect(slow.error).toHaveBeenLastCalledWith(original)
  expect(fast.error).toHaveBeenLastCalledWith(original)
  values.set(file, stats(20))
  await vi.advanceTimersByTimeAsync(100)
  expect(slow.publish).toHaveBeenCalledOnce()
  expect(fast.publish).toHaveBeenCalledOnce()
})

it('releases an already-aborted subscription without retaining its timer', async () => {
  const controller = new AbortController()
  controller.abort()
  const subscription = setPollingListener(file, file, { interval: 100, persistent: true }, scheduler, { publish: vi.fn(), rawEmitter: vi.fn(), errHandler: vi.fn() }, stats(2), controller.signal)
  expect(subscription).toBeUndefined()
  expect(vi.getTimerCount()).toBe(0)
})

it.each([0, 2])('preserves mixed Stats identities across %i unchanged polls and subsequent real changes', async (unchangedPolls) => {
  const initial = {
    size: 6n,
    mtimeMs: 1_793_280_000_123n,
    mtimeNs: 1_793_280_000_123_456_789n,
    ino: 1n,
    isDirectory,
  } as BigIntStats
  const current = { ...stats(6), mtimeMs: 1_793_280_000_123.4568 }
  // number Stats 保留纳秒折算的小数；只转换 bigint mtimeMs 仍会产生假事件。
  expect(Number(initial.mtimeMs)).not.toBe(current.mtimeMs)
  values.set(file, current)
  const existing = owner(100, true, file, initial)
  if (unchangedPolls) {
    await vi.advanceTimersByTimeAsync(100 * unchangedPolls)
    expect(existing.publish).not.toHaveBeenCalled()
    expect(existing.raw).not.toHaveBeenCalled()
    expect(existing.error).not.toHaveBeenCalled()
  }

  const resized = { ...current, size: 7 }
  values.set(file, resized)
  await vi.advanceTimersByTimeAsync(100)
  expect(existing.publish).toHaveBeenCalledOnce()
  expect(existing.raw).toHaveBeenCalledOnce()
  const firstPrevious = unchangedPolls ? current : initial
  const first = existing.publish.mock.calls[0]![0] as { current: Stats, previous: Stats | BigIntStats }
  expect(first.current).toBe(resized)
  expect(first.previous).toBe(firstPrevious)
  expect(existing.raw.mock.calls[0]![2]).toEqual({ current: resized, previous: firstPrevious })
  const rawFirst = existing.raw.mock.calls[0]![2] as { current: Stats, previous: Stats | BigIntStats }
  expect(rawFirst.current).toBe(resized)
  expect(rawFirst.previous).toBe(firstPrevious)

  const touched = { ...resized, mtimeMs: current.mtimeMs + 1 }
  values.set(file, touched)
  await vi.advanceTimersByTimeAsync(100)
  expect(existing.publish).toHaveBeenCalledTimes(2)
  expect(existing.raw).toHaveBeenCalledTimes(2)
  expect(existing.publish.mock.calls[1]![0]).toMatchObject({ current: touched, previous: resized })

  vi.mocked(promises.stat).mockRejectedValueOnce(Object.assign(new Error('asset removed'), { code: 'ENOENT' }))
  await vi.advanceTimersByTimeAsync(100)
  expect(existing.publish).toHaveBeenCalledTimes(3)
  expect(existing.raw).toHaveBeenCalledTimes(3)
  expect(existing.publish.mock.calls[2]![0]).toMatchObject({ current: { missing: true }, previous: touched })

  await vi.advanceTimersByTimeAsync(100)
  expect(existing.publish).toHaveBeenCalledTimes(4)
  expect(existing.raw).toHaveBeenCalledTimes(4)
  expect(existing.publish.mock.calls[3]![0]).toMatchObject({ current: touched, previous: { missing: true } })
  await vi.advanceTimersByTimeAsync(100)
  expect(existing.publish).toHaveBeenCalledTimes(4)
  expect(existing.raw).toHaveBeenCalledTimes(4)
  expect(existing.error).not.toHaveBeenCalled()
  expect(initial.size).toBe(6n)
  expect(initial.mtimeMs).toBe(1_793_280_000_123n)
})
