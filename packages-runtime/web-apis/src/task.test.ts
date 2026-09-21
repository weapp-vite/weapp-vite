import { expect, it, vi } from 'vitest'
import { queueMicrotaskPolyfill } from './task'

it('schedules callbacks when the mini-program module has no globalThis', async () => {
  const root = globalThis
  const descriptor = Object.getOwnPropertyDescriptor(root, 'globalThis')!
  const callback = vi.fn()
  let synchronousCalls = -1
  try {
    Object.defineProperty(root, 'globalThis', { configurable: true, value: undefined })
    queueMicrotaskPolyfill(callback)
    synchronousCalls = callback.mock.calls.length
  }
  finally {
    Object.defineProperty(root, 'globalThis', descriptor)
  }
  expect(synchronousCalls).toBe(0)
  await Promise.resolve()
  expect(callback).toHaveBeenCalledOnce()
})
