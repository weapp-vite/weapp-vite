import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function bounded(promise, label, timeoutMs = 30_000) {
  let timeout
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeoutMs)
    })])
  }
  finally {
    clearTimeout(timeout)
  }
}

/** 只观测 fixture 精确原生句柄；注入限定为一个目标目录的一次 acquisition。 */
export function instrumentNative(root, injection, trace) {
  const original = fs.watch
  const originalWatchFile = fs.watchFile
  const originalUnwatchFile = fs.unwatchFile
  const pollingHandles = []
  const pollingReleases = []
  const handles = []
  const attempts = []
  const restoreEvents = []
  let injected = 0
  let pollingSequence = 0
  const absolute = (file) => {
    let value = file instanceof URL ? fileURLToPath(file) : String(file)
    // 只统一观察路径；原生调用参数与注入的原始 Error 均保持原样。
    if (value.startsWith('\\\\?\\UNC\\')) {
      value = `\\\\${value.slice(8)}`
    }
    else if (/^\\\\\?\\[A-Z]:\\/i.test(value)) {
      value = value.slice(4)
    }
    return path.resolve(value)
  }
  const relative = file => path.relative(root, file).replaceAll('\\', '/')
  fs.watch = function (filename, ...args) {
    const file = absolute(filename)
    const label = relative(file)
    if (label.startsWith('../') || path.isAbsolute(label)) {
      return original.call(this, filename, ...args)
    }
    attempts.push(label)
    trace?.record('native.acquire', { file: label })
    if (injection && injected === 0 && file === injection.target) {
      injected++
      if (injection.missing) {
        fs.rmSync(file, { recursive: true })
      }
      trace?.record('native.injected', { file: label, missing: injection.missing, error: trace.error(injection.error) })
      throw injection.error
    }
    const native = original.call(this, filename, ...args)
    if (trace?.enabled) {
      const originalEmit = native.emit
      const originalEmitDescriptor = Object.getOwnPropertyDescriptor(native, 'emit')
      const emit = function (event, ...values) {
        if (event === 'change' || event === 'error' || event === 'close') {
          trace.record('native.emit', { file: label, event, ...(event === 'change' ? { eventType: values[0], filename: values[1] == null ? null : String(values[1]).replaceAll('\\', '/') } : {}), ...(event === 'error' ? { error: trace.error(values[0]) } : {}) })
        }
        return originalEmit.call(this, event, ...values)
      }
      native.emit = emit
      restoreEvents.push(() => {
        if (native.emit === emit) {
          if (originalEmitDescriptor) {
            Object.defineProperty(native, 'emit', originalEmitDescriptor)
          }
          else {
            delete native.emit
          }
        }
      })
    }
    let resolveClose
    const closed = new Promise((resolve) => {
      resolveClose = resolve
    })
    const record = { file, path: label, native, closeCalls: 0, closeEvents: 0, closed }
    const close = native.close
    native.close = function (...closeArgs) {
      record.closeCalls++
      trace?.record('native.close', { file: label, closeCalls: record.closeCalls })
      return close.apply(this, closeArgs)
    }
    native.once('close', () => {
      record.closeEvents++
      resolveClose()
    })
    handles.push(record)
    return native
  }
  fs.watchFile = function (filename, ...args) {
    const file = absolute(filename)
    const label = relative(file)
    const native = originalWatchFile.call(this, filename, ...args)
    if (label.startsWith('../') || path.isAbsolute(label)) {
      return native
    }
    const listener = args.findLast(value => typeof value === 'function')
    let resolveStop
    const stopped = new Promise((resolve) => {
      resolveStop = resolve
    })
    const record = { file, path: label, listener, native, acquiredSequence: ++pollingSequence, stoppedSequence: undefined, stopEvents: 0, stopped }
    native.once('stop', () => {
      record.stopEvents++
      record.stoppedSequence = ++pollingSequence
      resolveStop()
    })
    pollingHandles.push(record)
    return native
  }
  fs.unwatchFile = function (filename, ...args) {
    const label = relative(absolute(filename))
    if (!label.startsWith('../') && !path.isAbsolute(label)) {
      pollingReleases.push({ path: label, exactListener: typeof args[0] === 'function' })
    }
    return originalUnwatchFile.call(this, filename, ...args)
  }
  syncBuiltinESMExports()
  return {
    handles,
    attempts,
    pollingHandles,
    get injected() { return injected },
    async assertClosed() {
      await bounded(Promise.all(handles.map(record => record.closed)), 'all acquired native close events')
      assert(handles.every(record => record.closeCalls === 1 && record.closeEvents === 1), 'Every native handle must close exactly once')
      await bounded(Promise.all(pollingHandles.map(record => record.stopped)), 'all acquired polling stop events')
      assert(pollingHandles.every(record => record.stopEvents === 1), 'Every polling native handle must stop exactly once')
    },
    async emergencyClose() {
      const open = handles.filter(record => record.closeEvents === 0)
      for (const record of open) {
        record.native.close()
      }
      await bounded(Promise.all(open.map(record => record.closed)), 'diagnostic cleanup of exact native handles')
      const pollingOpen = pollingHandles.filter(record => record.stopEvents === 0)
      for (const record of pollingOpen) {
        originalUnwatchFile(record.file, record.listener)
      }
      await bounded(Promise.all(pollingOpen.map(record => record.stopped)), 'diagnostic cleanup of exact polling handles')
      return [...open.map(record => record.path), ...pollingOpen.map(record => `polling:${record.path}`)]
    },
    snapshot() {
      return { attempts, injected, pollingHandles: pollingHandles.map(({ path, stopEvents, acquiredSequence, stoppedSequence }) => ({ file: path, stopEvents, acquiredSequence, stoppedSequence })), pollingReleases, handles: handles.map(({ path: file, closeCalls, closeEvents }) => ({ file, closeCalls, closeEvents })) }
    },
    restore() {
      for (const restore of restoreEvents) {
        restore()
      }
      fs.watch = original
      fs.watchFile = originalWatchFile
      fs.unwatchFile = originalUnwatchFile
      syncBuiltinESMExports()
    },
  }
}
