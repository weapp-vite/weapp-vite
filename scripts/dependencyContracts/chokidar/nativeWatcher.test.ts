import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { assertNativeWatcherClosed, observeNativeWatcher } from './nativeWatcher.mjs'

type Callback = (this: FSEvent, ...args: unknown[]) => unknown

class FSEvent {
  initialized = true
  callback?: Callback
  result = Symbol('original native return')
  close = vi.fn(function (this: FSEvent, callback?: Callback, ..._args: unknown[]) {
    this.callback = callback
    return this.result
  })

  complete(...args: unknown[]) {
    return this.callback!.apply(this, args)
  }
}

function fixture({ emitClose = true } = {}) {
  const handle = new FSEvent()
  const result = Symbol('original public return')
  class Watcher extends EventEmitter {
    _handle: FSEvent | null = handle
    close = vi.fn(function (this: Watcher, ..._args: unknown[]) {
      if (this._handle === null) {
        return
      }
      this._handle.close()
      this._handle = null
      if (emitClose) {
        this.emit('close')
      }
      return result
    })
  }
  const native = new Watcher()
  const publicClose = native.close
  const nativeClose = handle.close
  const record = observeNativeWatcher(native, { path: 'src/owned.txt', afterPublicClose: false })
  const error = Object.assign(new Error('the exact native watch failure'), { code: 'EPERM' })
  function errorClose() {
    handle.close()
    native._handle = null
    native.emit('error', error)
  }
  return { native, handle, record, result, publicClose, nativeClose, error, errorClose }
}

it('requires actual native completion and preserves public close receiver, arguments and return', async () => {
  const ctx = fixture()
  const args = ['original argument', { size: 42 }]
  expect(ctx.native.close(...args)).toBe(ctx.result)
  expect(ctx.publicClose.mock.contexts).toEqual([ctx.native])
  expect(ctx.publicClose.mock.calls).toEqual([args])
  expect(ctx.record).toMatchObject({ closed: false, closeCalls: 1, closeEvents: 1, nativeCloseRequests: 1, nativeCloseCompletions: 0 })
  expect(() => assertNativeWatcherClosed(ctx.record)).toThrow()
  ctx.handle.complete()
  await ctx.record.closePromise
  expect(ctx.record.termination).toBe('public-close')
  expect(() => assertNativeWatcherClosed(ctx.record, true)).not.toThrow()
})

it('retains the shared inode exactly-once public close contract across repeated owner closes', async () => {
  const ctx = fixture()
  let ownerClosed = false
  const ownerClose = () => {
    if (!ownerClosed) {
      ownerClosed = true
      ctx.native.close()
    }
  }
  ownerClose()
  ownerClose()
  ctx.handle.complete()
  await ctx.record.closePromise
  expect(ctx.nativeClose).toHaveBeenCalledOnce()
  expect(() => assertNativeWatcherClosed(ctx.record, true)).not.toThrow()
  ctx.native.close()
  expect(ctx.nativeClose).toHaveBeenCalledOnce()
  expect(() => assertNativeWatcherClosed(ctx.record, true)).toThrow('one public close')
})

it('accepts the exact completed Node error closure without inventing a public close event', async () => {
  const ctx = fixture()
  ctx.errorClose()
  expect(ctx.record.closed).toBe(false)
  expect(ctx.native.close()).toBeUndefined()
  ctx.handle.complete()
  await ctx.record.closePromise
  expect(ctx.record).toMatchObject({ closed: true, closeCalls: 1, closeEvents: 0, nativeCloseRequests: 1, nativeCloseCompletions: 1, errorEvents: 1, termination: 'native-error' })
  expect(() => assertNativeWatcherClosed(ctx.record)).not.toThrow()
  expect(() => assertNativeWatcherClosed(ctx.record, true)).toThrow('one public close event')
})

it('rejects an error while the captured native handle remains live', async () => {
  const ctx = fixture()
  ctx.native.emit('error', ctx.error)
  await expect(ctx.record.closePromise).rejects.toThrow('error alone')
  expect(ctx.record.closed).toBe(false)
  expect(ctx.record.lastError).toEqual({ code: 'EPERM', message: ctx.error.message })
})

it('rejects null and a forged public event without a captured native close request', async () => {
  const ctx = fixture()
  ctx.native._handle = null
  ctx.native.emit('close')
  await expect(ctx.record.closePromise).rejects.toThrow('cannot substitute')
  expect(ctx.record.nativeCloseRequests).toBe(0)
  expect(ctx.record.closed).toBe(false)
})

it('keeps a native close request unconfirmed until its actual callback arrives', async () => {
  const ctx = fixture()
  ctx.native.close()
  let complete = false
  void ctx.record.closePromise.then(() => {
    complete = true
  })
  await Promise.resolve()
  expect(complete).toBe(false)
  expect(ctx.record).toMatchObject({ closed: false, closeEvents: 1, nativeCloseCompletions: 0 })
  ctx.handle.complete()
  await ctx.record.closePromise
})

it('still requires the public event for a normal close after native completion', async () => {
  const ctx = fixture({ emitClose: false })
  ctx.native.close()
  ctx.handle.complete()
  expect(ctx.record).toMatchObject({ closed: false, nativeCloseCompletions: 1, closeEvents: 0 })
  expect(() => assertNativeWatcherClosed(ctx.record)).toThrow()
  ctx.native.emit('close')
  await ctx.record.closePromise
})

it('rejects native completion without releasing the captured wrapper handle', async () => {
  const ctx = fixture()
  ctx.handle.close()
  ctx.handle.complete()
  await expect(ctx.record.closePromise).rejects.toThrow('without releasing')
  expect(ctx.record.closed).toBe(false)
})

it('rejects a replacement handle while preserving the original public close behavior', async () => {
  const ctx = fixture()
  const replacement = new FSEvent()
  ctx.native._handle = replacement
  expect(ctx.native.close()).toBe(ctx.result)
  await expect(ctx.record.closePromise).rejects.toThrow('replace or borrow')
  expect(replacement.close).toHaveBeenCalledOnce()
  expect(ctx.nativeClose).not.toHaveBeenCalled()
})

it('preserves native close callback receiver, arguments, result and extra native close arguments', async () => {
  const ctx = fixture()
  const callbackResult = Symbol('original callback return')
  const callback = vi.fn(function (this: FSEvent, ..._args: unknown[]) {
    expect(this).toBe(ctx.handle)
    return callbackResult
  })
  const tag = { original: true }
  expect(ctx.handle.close(callback, tag)).toBe(ctx.handle.result)
  expect(ctx.nativeClose.mock.contexts).toEqual([ctx.handle])
  expect(ctx.nativeClose.mock.calls[0]![1]).toBe(tag)
  ctx.native._handle = null
  ctx.native.emit('error', ctx.error)
  expect(ctx.handle.complete('original completion argument', tag)).toBe(callbackResult)
  expect(callback.mock.contexts).toEqual([ctx.handle])
  expect(callback.mock.calls).toEqual([['original completion argument', tag]])
  await ctx.record.closePromise
})

it('preserves a native close throw and rejects its terminal evidence with the same error', async () => {
  const ctx = fixture()
  const error = new Error('original native close failure')
  ctx.nativeClose.mockImplementation(() => {
    throw error
  })
  expect(() => ctx.native.close()).toThrow(error)
  await expect(ctx.record.closePromise).rejects.toBe(error)
  expect(ctx.record.closed).toBe(false)
})

it('preserves a callback throw and never confirms the failed callback', async () => {
  const ctx = fixture()
  const error = new Error('original completion callback failure')
  ctx.handle.close(() => {
    throw error
  })
  ctx.native._handle = null
  ctx.native.emit('error', ctx.error)
  expect(() => ctx.handle.complete()).toThrow(error)
  await expect(ctx.record.closePromise).rejects.toBe(error)
  expect(ctx.record.closed).toBe(false)
})

it('returns the original callback Promise and retains its eventual rejection', async () => {
  const ctx = fixture()
  const gate = Promise.withResolvers<void>()
  const error = new Error('original asynchronous callback failure')
  ctx.handle.close(() => gate.promise)
  ctx.native._handle = null
  ctx.native.emit('error', ctx.error)
  expect(ctx.handle.complete()).toBe(gate.promise)
  expect(ctx.record.closed).toBe(false)
  gate.reject(error)
  await expect(gate.promise).rejects.toBe(error)
  await expect(ctx.record.closePromise).rejects.toBe(error)
})

it('preserves a reentrant callback public close without duplicating native requests or events', async () => {
  const ctx = fixture()
  const result = Symbol('reentrant callback result')
  ctx.handle.close(() => {
    expect(ctx.record.closed).toBe(false)
    expect(ctx.native.close('reentrant argument')).toBeUndefined()
    return result
  })
  ctx.native._handle = null
  ctx.native.emit('error', ctx.error)
  expect(ctx.handle.complete()).toBe(result)
  await ctx.record.closePromise
  expect(ctx.publicClose.mock.calls).toEqual([['reentrant argument']])
  expect(ctx.record).toMatchObject({ nativeCloseRequests: 1, nativeCloseCompletions: 1, closeCalls: 1, closeEvents: 0 })
  expect(() => assertNativeWatcherClosed(ctx.record)).not.toThrow()
})

it.each(['request', 'completion', 'receiver'] as const)('rejects an invalid native %s without inventing closure', async (kind) => {
  const ctx = fixture()
  ctx.handle.close()
  ctx.native._handle = null
  if (kind === 'request') {
    ctx.handle.close()
  }
  else if (kind === 'completion') {
    ctx.handle.complete()
    ctx.handle.complete()
  }
  else {
    ctx.handle.callback!.call(new FSEvent())
  }
  await expect(ctx.record.closePromise).rejects.toThrow('exact captured FSEvent')
  expect(ctx.record.closed).toBe(false)
  expect(() => assertNativeWatcherClosed(ctx.record)).toThrow()
})

it.each(['close', 'completion', 'error'] as const)('retains a late invalid %s after resolved close for final strict validation', async (kind) => {
  const ctx = fixture()
  ctx.native.close()
  ctx.handle.complete()
  await ctx.record.closePromise
  if (kind === 'completion') {
    ctx.handle.complete()
  }
  else {
    ctx.native.emit(kind, ctx.error)
  }
  expect(ctx.record.closed).toBe(false)
  expect(() => assertNativeWatcherClosed(ctx.record)).toThrow('observation must remain valid')
})

it.each(['recursive', 'uninitialized', 'unknown-constructor'] as const)('registers an unsupported %s watcher and retains its exact public cleanup path', async (kind) => {
  const watcher = new EventEmitter() as EventEmitter & { _handle?: { initialized?: boolean, close: () => void }, close: () => void }
  const nativeClose = vi.fn()
  if (kind !== 'recursive') {
    watcher._handle = kind === 'uninitialized' ? new FSEvent() : { initialized: true, close: nativeClose }
    if (kind === 'uninitialized') {
      watcher._handle.initialized = false
    }
  }
  const publicClose = vi.fn(() => {
    watcher._handle?.close()
    watcher.emit('close')
  })
  watcher.close = publicClose
  const records = [observeNativeWatcher(watcher, { path: 'src/owned.txt', afterPublicClose: false })]
  expect(records[0]!.native).toBe(watcher)
  await expect(records[0]!.closePromise).rejects.toThrow('Unsupported fs.watch native handle shape')
  records[0]!.native.close()
  expect(publicClose).toHaveBeenCalledOnce()
  expect(records[0]!.closed).toBe(false)
  expect(() => assertNativeWatcherClosed(records[0])).toThrow()
})
