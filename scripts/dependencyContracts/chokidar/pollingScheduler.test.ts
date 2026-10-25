import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createPollingScheduler } from './pollingScheduler.mjs'

const file = path.resolve('polling-observation', 'owned.json')

it('preserves the exact timer and observes its own clear and persistence changes', async () => {
  const observation = createPollingScheduler()
  let called = false
  const timer = observation.withPaths(file, () => observation.scheduler.setTimeout(() => {
    called = true
  }, 1000))
  expect(observation.timers[0]?.timer).toBe(timer)
  expect(timer.unref()).toBe(timer)
  observation.scheduler.clearTimeout(timer)
  await observation.assertAllClosed(1000)
  expect(called).toBe(false)
  expect(observation.snapshot(path.dirname(file)).timers).toEqual([
    expect.objectContaining({ path: 'owned.json', delay: 1000, fired: false, cleared: true, persistent: false, refChanges: ['unref'] }),
  ])
})

it('keeps a fired timer incomplete until its exact observed stat settles', async () => {
  const observation = createPollingScheduler()
  const started = Promise.withResolvers<void>()
  const read = Promise.withResolvers<object>()
  observation.withPaths(file, () => observation.scheduler.setTimeout(() => {
    expect(observation.observeStat(file, () => read.promise)).toBe(read.promise)
    started.resolve()
  }, 0))
  await started.promise
  let closed = false
  const closing = observation.assertAllClosed(1000).then(() => {
    closed = true
  })
  await new Promise(resolve => setImmediate(resolve))
  expect(closed).toBe(false)
  expect(observation.snapshot(path.dirname(file)).reads).toEqual([{ path: 'owned.json', timer: 1, settled: false }])
  read.resolve({ size: 42 })
  await closing
  expect(observation.snapshot(path.dirname(file)).reads[0]?.settled).toBe(true)
})

it('preserves a rejected stat Promise and records its terminal observation independently', async () => {
  const observation = createPollingScheduler()
  const failure = new Error('exact original stat rejection')
  const read = Promise.reject(failure)
  let result: Promise<unknown> | undefined
  const started = Promise.withResolvers<void>()
  // 先登记原拒绝，观察器仍须返回同一个 Promise。
  read.catch(() => {})
  observation.withPaths(file, () => observation.scheduler.setTimeout(() => {
    result = observation.observeStat(file, () => read)
    started.resolve()
  }, 0))
  await started.promise
  expect(result).toBe(read)
  await expect(result).rejects.toBe(failure)
  await observation.assertAllClosed(1000)
  expect(observation.snapshot(path.dirname(file)).reads[0]?.settled).toBe(true)
})

it('limits emergency cleanup to timers registered by this observation', async () => {
  const observation = createPollingScheduler()
  const owned = observation.withPaths(file, () => observation.scheduler.setTimeout(() => {}, 1000))
  const external = setTimeout(() => {}, 1000)
  const clear = vi.spyOn(globalThis, 'clearTimeout')
  try {
    expect(await observation.emergencyClose(1000)).toEqual(['scheduler:1'])
    expect(clear).toHaveBeenCalledWith(owned)
    expect(clear).not.toHaveBeenCalledWith(external)
    expect(observation.snapshot(path.dirname(file)).timers[0]?.cleared).toBe(true)
  }
  finally {
    clear.mockRestore()
    clearTimeout(external)
  }
})
