import { expect, it, vi } from 'vitest'
import { HmrDeliveryCoordinator } from './deliveryCoordinator'

it('does not commit newer styles until the previous payload has executed', async () => {
  const acknowledged = Promise.withResolvers<void>()
  const events: string[] = []
  const queue = new HmrDeliveryCoordinator(vi.fn())
  for (const id of ['first', 'second']) {
    queue.enqueue({
      prepare: async () => ({
        commit: async () => {
          events.push(`style:${id}`)
        },
        publish: async () => {
          events.push(`patch:${id}`)
          if (id === 'first') {
            await acknowledged.promise
          }
        },
      }),
    })
  }
  await vi.waitFor(() => expect(events).toEqual(['style:first', 'patch:first']))
  acknowledged.resolve()
  await vi.waitFor(() => expect(events).toEqual(['style:first', 'patch:first', 'style:second', 'patch:second']))
  await queue.close()
})

it('retains a failed batch and retries it before later updates', async () => {
  const errors = vi.fn()
  const commit = vi.fn().mockRejectedValueOnce(new Error('partial write')).mockResolvedValue(undefined)
  const publish = vi.fn().mockResolvedValue(undefined)
  const prepare = vi.fn(async () => ({ commit, publish }))
  const queue = new HmrDeliveryCoordinator(errors)
  queue.enqueue({ prepare })
  await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce())
  expect(publish).not.toHaveBeenCalled()
  queue.retry()
  await vi.waitFor(() => expect(publish).toHaveBeenCalledOnce())
  expect(commit).toHaveBeenCalledTimes(2)
  await queue.close()
})

it('requests synchronization when a disconnected client exhausts the pending budget', async () => {
  const execution = Promise.withResolvers<void>()
  const overflow = vi.fn()
  const queue = new HmrDeliveryCoordinator(vi.fn(), overflow, 2)
  const task = { prepare: async () => ({ commit: async () => {}, publish: () => execution.promise }) }
  queue.enqueue(task)
  queue.enqueue(task)
  queue.enqueue(task)
  expect(overflow).toHaveBeenCalledOnce()
  execution.resolve()
  await queue.close()
})

it('resynchronizes after failed immutable compilation when a newer source arrives', async () => {
  const failed = vi.fn()
  let queue: HmrDeliveryCoordinator
  const reset = vi.fn(() => queue.reset())
  queue = new HmrDeliveryCoordinator(failed, reset)
  queue.enqueue({ prepare: async () => {
    throw new Error('invalid captured CSS')
  } })
  await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce())
  const newer = vi.fn(async () => ({ commit: async () => {}, publish: async () => {} }))
  queue.enqueue({ prepare: newer })
  expect(reset).toHaveBeenCalledOnce()
  expect(newer).not.toHaveBeenCalled()
  const published = vi.fn(async () => {})
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: published }) })
  await vi.waitFor(() => expect(published).toHaveBeenCalledOnce())
  await queue.close()
})
