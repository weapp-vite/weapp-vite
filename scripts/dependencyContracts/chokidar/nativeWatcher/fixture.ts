import { EventEmitter } from 'node:events'
import { vi } from 'vitest'
import { observeNativeWatcher } from '../nativeWatcher.mjs'

type Callback = (this: FSEvent, ...args: unknown[]) => unknown

export class FSEvent {
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

export function createNativeWatcherFixture({ emitClose = true } = {}) {
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
