import { setImmediate } from 'node:timers/promises'
import { expect, it, vi } from 'vitest'
import { createHostResources } from './resources.mjs'

it('waits for a watcher acquired after shutdown and shares one close result', async () => {
  const resources = createHostResources()
  const created = Promise.withResolvers<object>()
  const released = Promise.withResolvers<void>()
  const close = vi.fn(() => released.promise)
  const acquiring = resources.acquire(async () => {
    const watcher = await created.promise
    await resources.own(watcher, close)
    return watcher
  })
  const stopping = resources.close()
  expect(resources.close()).toBe(stopping)
  let stopped = false
  void stopping.then(() => stopped = true)
  await setImmediate()
  expect(stopped).toBe(false)
  created.resolve({})
  await setImmediate()
  expect(close).toHaveBeenCalledOnce()
  expect(stopped).toBe(false)
  released.resolve()
  await Promise.all([acquiring, stopping])
  expect(stopped).toBe(true)
  expect(close).toHaveBeenCalledOnce()
})

it('retains the acquisition error while still releasing other owned resources', async () => {
  const resources = createHostResources()
  const created = Promise.withResolvers<void>()
  const failure = new Error('native watch acquisition failed')
  const close = vi.fn()
  resources.own({}, close)
  const acquiring = resources.acquire(async () => {
    await created.promise
    throw failure
  })
  const stopping = resources.close()
  const result = Promise.allSettled([acquiring, stopping])
  created.resolve()
  expect(await result).toEqual([
    { status: 'rejected', reason: failure },
    { status: 'rejected', reason: failure },
  ])
  expect(close).toHaveBeenCalledOnce()
  expect(resources.close()).toBe(stopping)
})

it('preserves every distinct close error and still attempts all resources', async () => {
  const resources = createHostResources()
  const first = new Error('first native resource failed')
  const second = new Error('second native resource failed')
  const close = vi.fn()
  resources.own({}, () => {
    throw first
  })
  resources.own({}, () => Promise.reject(second))
  resources.own({}, close)
  await expect(resources.close()).rejects.toMatchObject({ errors: [first, second], cause: first })
  expect(close).toHaveBeenCalledOnce()
})

it('rejects new builds after shutdown and keeps independent project resources alive', async () => {
  const first = createHostResources()
  const second = createHostResources()
  const firstClose = vi.fn()
  const secondClose = vi.fn()
  const build = vi.fn()
  first.own({}, firstClose)
  second.own({}, secondClose)
  await first.close()
  await expect(first.acquire(build)).rejects.toThrow('after shutdown was requested')
  expect(build).not.toHaveBeenCalled()
  expect(firstClose).toHaveBeenCalledOnce()
  expect(secondClose).not.toHaveBeenCalled()
  await second.close()
  expect(secondClose).toHaveBeenCalledOnce()
})

it('does not consume a dynamic server close or a late resource before restart acquisition completes', async () => {
  const resources = createHostResources()
  const gate = Promise.withResolvers<void>()
  const originalClose = vi.fn()
  const currentClose = vi.fn()
  const lateClose = vi.fn()
  const server = { close: originalClose }
  resources.own(server, () => server.close())
  const restarting = resources.acquire(async () => {
    await gate.promise
    await resources.own({}, lateClose)
    expect(originalClose).not.toHaveBeenCalled()
    expect(lateClose).not.toHaveBeenCalled()
    server.close = currentClose
  })
  const stopping = resources.close()
  await setImmediate()
  expect(originalClose).not.toHaveBeenCalled()
  gate.resolve()
  await Promise.all([restarting, stopping])
  expect(originalClose).not.toHaveBeenCalled()
  expect(currentClose).toHaveBeenCalledOnce()
  expect(lateClose).toHaveBeenCalledOnce()
})
