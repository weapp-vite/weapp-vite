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

it('preserves close receivers and errors while releasing completed tracking', async () => {
  const ownership = new SequenceResourceOwnership()
  const resource = {
    message: 'close failed',
    async close() { throw new Error(this.message) },
  }
  ownership.track(resource)
  await expect(resource.close()).rejects.toThrow('close failed')
  expect(ownership.size).toBe(0)
})
