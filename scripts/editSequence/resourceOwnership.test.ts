import { expect, it, vi } from 'vitest'
import { SequenceResourceOwnership } from './resourceOwnership'

it('retains replaced resources until their actual asynchronous close completes', async () => {
  const ownership = new SequenceResourceOwnership()
  const closed = Promise.withResolvers<void>()
  const first = { close: vi.fn(() => closed.promise) }
  const second = { close: vi.fn(async () => {}) }
  ownership.track(first)
  ownership.track(first)
  ownership.track(second)
  expect(ownership.size).toBe(2)
  const closing = first.close()
  expect(ownership.size).toBe(2)
  closed.resolve()
  await closing
  expect(ownership.size).toBe(1)
  await first.close()
  expect(ownership.size).toBe(1)
  await second.close()
  expect(ownership.size).toBe(0)
})

it('preserves close receivers and retains failures swallowed by an outer allSettled', async () => {
  const ownership = new SequenceResourceOwnership()
  const failure = new Error('close failed')
  const resource = {
    failure,
    async close() { throw this.failure },
  }
  ownership.track(resource)
  await Promise.allSettled([resource.close()])
  expect(ownership.size).toBe(1)
  expect(() => ownership.assertReleased()).toThrow(failure)
  expect(ownership.errors).toEqual([failure])
  expect(ownership.size).toBe(1)
})

it('shares one pending and successful close result without reacquiring the same resource', async () => {
  const ownership = new SequenceResourceOwnership()
  const closed = Promise.withResolvers<string>()
  const nativeClose = vi.fn(() => closed.promise)
  const resource = { close: nativeClose }
  ownership.track(resource)
  const first = resource.close()
  const concurrent = resource.close()
  expect(concurrent).toBe(first)
  expect(ownership.size).toBe(1)
  expect(() => ownership.assertReleased()).toThrow('retained 1 resource')
  closed.resolve('closed')
  await expect(first).resolves.toBe('closed')
  expect(resource.close()).toBe(first)
  ownership.track(resource)
  expect(ownership.size).toBe(0)
  expect(ownership.errors).toEqual([])
  expect(() => ownership.assertReleased()).not.toThrow()
  expect(nativeClose).toHaveBeenCalledTimes(1)
})

it('caches a synchronous close failure and never retries a failed owner implicitly', async () => {
  const ownership = new SequenceResourceOwnership()
  const failure = new Error('synchronous close failed')
  const nativeClose = vi.fn(() => {
    throw failure
  })
  const resource = { close: nativeClose }
  ownership.track(resource)
  const first = resource.close()
  await expect(first).rejects.toBe(failure)
  const repeated = resource.close()
  await expect(repeated).rejects.toBe(failure)
  expect(repeated).toBe(first)
  expect(nativeClose).toHaveBeenCalledTimes(1)
  expect(ownership.size).toBe(1)
  expect(() => ownership.assertReleased()).toThrow(failure)
})

it('retains every original failure when multiple owners reject', async () => {
  const ownership = new SequenceResourceOwnership()
  const failures = [new Error('first close failed'), new Error('second close failed')]
  const resources = failures.map(failure => ({
    close: async () => {
      throw failure
    },
  }))
  resources.forEach(resource => ownership.track(resource))
  await Promise.allSettled(resources.map(resource => resource.close()))
  expect(ownership.size).toBe(2)
  expect(ownership.errors).toEqual(failures)
  expect(() => ownership.assertReleased()).toThrow(expect.objectContaining({ errors: failures }))
})

it('starts native close before returning its shared promise', async () => {
  const ownership = new SequenceResourceOwnership()
  const nativeClose = vi.fn(() => 'closed')
  const resource = { close: nativeClose }
  ownership.track(resource)
  const closing = resource.close()
  expect(nativeClose).toHaveBeenCalledTimes(1)
  await expect(closing).resolves.toBe('closed')
  expect(ownership.size).toBe(0)
})

it('returns the cached promise during synchronous native close reentry', async () => {
  const ownership = new SequenceResourceOwnership()
  const closed = Promise.withResolvers<void>()
  let reentered: unknown
  const resource = { close: vi.fn<() => Promise<void>>() }
  const nativeClose = resource.close.mockImplementation(() => {
    reentered = resource.close()
    return closed.promise
  })
  ownership.track(resource)
  const closing = resource.close()
  closed.resolve()
  expect(reentered).toBe(closing)
  await closing
  expect(nativeClose).toHaveBeenCalledTimes(1)
  expect(ownership.size).toBe(0)
})
