import { expect, it, vi } from 'vitest'
import { HmrDeliveryCoordinator } from './deliveryCoordinator'

it('includes deliveries queued during a pending publication and waits for disposal', async () => {
  const first = Promise.withResolvers<void>()
  const second = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  const queue = new HmrDeliveryCoordinator(vi.fn())
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: () => first.promise }) })
  let settled = false
  const waiting = queue.whenSettled().then(() => {
    settled = true
  })
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: () => second.promise, dispose: () => disposed.promise }) })
  first.resolve()
  await Promise.resolve()
  expect(settled).toBe(false)
  second.resolve()
  await Promise.resolve()
  expect(settled).toBe(false)
  disposed.resolve()
  await waiting
  expect(settled).toBe(true)
  await queue.close()
})

it('rejects a failed generation but allows its explicit successful retry to settle', async () => {
  const error = new Error('publish failed')
  const publish = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
  const queue = new HmrDeliveryCoordinator(vi.fn())
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish }) })
  await expect(queue.whenSettled()).rejects.toBe(error)
  queue.retry()
  await expect(queue.whenSettled()).resolves.toBeUndefined()
  expect(publish).toHaveBeenCalledTimes(2)
  await queue.close()
})

it('does not deadlock a concurrent close or treat a closed queue as a completed live publication', async () => {
  const published = Promise.withResolvers<void>()
  const queue = new HmrDeliveryCoordinator(vi.fn())
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: () => published.promise }) })
  const waiting = expect(queue.whenSettled()).rejects.toThrow('closed before settlement')
  const closing = queue.close()
  published.resolve()
  await Promise.all([waiting, closing])
})

it.each(['reset', 'close'] as const)('waits for prepared pending resources disposed by %s exactly once', async (operation) => {
  const publishing = Promise.withResolvers<void>()
  const published = Promise.withResolvers<void>()
  const disposing = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  const dispose = vi.fn(async () => {
    disposing.resolve()
    await disposed.promise
  })
  const queue = new HmrDeliveryCoordinator(vi.fn())
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: async () => {
    publishing.resolve()
    await published.promise
  } }) })
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: async () => {}, dispose }) })
  await publishing.promise
  let settled = false
  const operationResult = queue[operation]()
  const waiting = (operation === 'close' ? operationResult! : queue.whenSettled()).then(() => {
    settled = true
  })
  await disposing.promise
  published.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(settled).toBe(false)
  queue.reset()
  disposed.resolve()
  await waiting
  expect(dispose).toHaveBeenCalledOnce()
  expect(settled).toBe(true)
  await queue.close()
})
