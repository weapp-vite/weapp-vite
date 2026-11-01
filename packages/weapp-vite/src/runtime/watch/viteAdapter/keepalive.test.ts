import { afterEach, expect, it, vi } from 'vitest'
import { createViteWatcherKeepalive } from './keepalive'

afterEach(() => vi.restoreAllMocks())

it('uses a single real owner timer to provide ref/unref behavior independently of backend handles', () => {
  const timer = { ref: vi.fn(), unref: vi.fn() }
  const interval = vi.spyOn(globalThis, 'setInterval').mockReturnValue(timer as unknown as ReturnType<typeof setInterval>)
  const clear = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
  const owner = createViteWatcherKeepalive(false)
  expect(interval).toHaveBeenCalledTimes(1)
  expect(timer.unref).toHaveBeenCalledTimes(1)
  owner.ref()
  owner.unref()
  expect(timer.ref).toHaveBeenCalledTimes(1)
  expect(timer.unref).toHaveBeenCalledTimes(2)
  owner.close()
  owner.ref()
  expect(clear).toHaveBeenCalledExactlyOnceWith(timer)
  expect(timer.ref).toHaveBeenCalledTimes(1)
})
