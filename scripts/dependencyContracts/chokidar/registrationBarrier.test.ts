import type { observeNativeWatcher } from './nativeWatcher.mjs'
import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { assertNativeWatcherClosed, closeDarwinRegistrationBarrier } from './nativeWatcher.mjs'

class FSEvent {
  initialized = true
  completion?: () => void
  close(callback: () => void) {
    this.completion = callback
  }
}

function fixture() {
  const handle = new FSEvent()
  class Watcher extends EventEmitter {
    _handle: FSEvent | null = handle
    close = vi.fn(() => {
      this._handle!.close(() => {})
      this._handle = null
      this.emit('close')
    })
  }
  return { native: new Watcher(), handle }
}

it.each(['linux', 'win32'])('does not acquire a preparation watcher on %s', (actualPlatform) => {
  const watch = vi.fn()
  const register = vi.fn()
  expect(closeDarwinRegistrationBarrier({ actualPlatform, directory: 'fixture', watch, register })).toBeUndefined()
  expect(watch).not.toHaveBeenCalled()
  expect(register).not.toHaveBeenCalled()
})

it('registers only its own watcher before closing and awaits the exact native completion', async () => {
  const ctx = fixture()
  const unrelated = fixture()
  const publicClose = ctx.native.close
  const register = vi.fn((record: ReturnType<typeof observeNativeWatcher>) => {
    expect(record.native).toBe(ctx.native)
    expect(publicClose).not.toHaveBeenCalled()
  })
  const watch = vi.fn(() => ctx.native)
  const barrier = closeDarwinRegistrationBarrier({ actualPlatform: 'darwin', directory: 'fixture', watch, register })!
  expect(watch).toHaveBeenCalledExactlyOnceWith('fixture')
  expect(register).toHaveBeenCalledExactlyOnceWith(barrier)
  expect(barrier).toMatchObject({ purpose: 'directory-registration-barrier', closed: false, closeCalls: 1, closeEvents: 1, nativeCloseRequests: 1, nativeCloseCompletions: 0 })
  expect(() => assertNativeWatcherClosed(barrier, true)).toThrow()
  ctx.handle.completion!.call(ctx.handle)
  await barrier.closePromise
  expect(() => assertNativeWatcherClosed(barrier, true)).not.toThrow()
  expect(unrelated.native.close).not.toHaveBeenCalled()
  expect(unrelated.native._handle).toBe(unrelated.handle)
})

it('preserves an acquisition error without claiming a completed registration barrier', () => {
  const original = new Error('original native acquisition failure')
  const register = vi.fn()
  expect(() => closeDarwinRegistrationBarrier({
    actualPlatform: 'darwin',
    directory: 'fixture',
    watch: () => {
      throw original
    },
    register,
  })).toThrow(original)
  expect(register).not.toHaveBeenCalled()
})

it('keeps a registered failed close and its original error for precise cleanup', async () => {
  const ctx = fixture()
  const original = new Error('original native close failure')
  ctx.native.close.mockImplementation(() => {
    throw original
  })
  const register = vi.fn()
  expect(() => closeDarwinRegistrationBarrier({
    actualPlatform: 'darwin',
    directory: 'fixture',
    watch: () => ctx.native,
    register,
  })).toThrow(original)
  const record = register.mock.calls[0]![0]
  expect(record.native).toBe(ctx.native)
  expect(record.closed).toBe(false)
  await expect(record.closePromise).rejects.toBe(original)
})
