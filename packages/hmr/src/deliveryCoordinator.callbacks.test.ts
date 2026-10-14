import { expect, it, vi } from 'vitest'
import { HmrDeliveryCoordinator } from './deliveryCoordinator'

it('preserves the delivery failure when its resynchronization callback throws and still releases all resources', async () => {
  const primary = new Error('commit failed')
  const resync = new Error('resync callback failed')
  const commit = Promise.withResolvers<void>()
  const dispose = vi.fn()
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError, () => {
    throw resync
  })
  queue.enqueue({ prepare: async () => ({ commit: () => commit.promise, publish: async () => {}, dispose }) })
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: async () => {}, dispose }) })
  const waiting = expect(queue.whenSettled()).rejects.toBe(primary)
  commit.reject(primary)
  await waiting
  await expect(queue.close()).resolves.toBeUndefined()
  expect(dispose).toHaveBeenCalledTimes(2)
  expect(onError).toHaveBeenCalledWith(primary)
  expect(onError).toHaveBeenCalledWith(resync)
})

it('waits for every closing disposer when a resync callback starts close and then throws', async () => {
  const primary = new Error('commit failed')
  const secondary = new Error('resync failed')
  const cleanup = new Error('later disposer failed')
  const committing = Promise.withResolvers<void>()
  const disposing = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  let closed = false
  let closing: Promise<unknown> | undefined
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError, () => {
    closing ??= queue.close().then(
      () => {
        closed = true
        return undefined
      },
      (error) => {
        closed = true
        return error
      },
    )
    throw secondary
  })
  queue.enqueue({ prepare: async () => ({ commit: () => committing.promise, publish: async () => {} }) })
  queue.enqueue({ prepare: async () => ({
    commit: async () => {},
    publish: async () => {},
    dispose: async () => {
      disposing.resolve()
      await disposed.promise
      throw cleanup
    },
  }) })
  const waiting = queue.whenSettled().catch(error => error)
  committing.reject(primary)
  await disposing.promise
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(closed).toBe(false)
  disposed.resolve()
  const [settlement, closeResult] = await Promise.all([waiting, closing])
  expect(settlement).toBe(cleanup)
  expect(closeResult).toBe(cleanup)
  expect(onError).toHaveBeenCalledWith(primary)
  expect(onError).toHaveBeenCalledWith(secondary)
})
