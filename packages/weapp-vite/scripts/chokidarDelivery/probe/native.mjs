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
  const handles = []
  const attempts = []
  const restoreEvents = []
  let injected = 0
  const absolute = file => path.resolve(file instanceof URL ? fileURLToPath(file) : String(file))
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
  syncBuiltinESMExports()
  return {
    handles,
    attempts,
    get injected() { return injected },
    async assertClosed() {
      await bounded(Promise.all(handles.map(record => record.closed)), 'all acquired native close events')
      assert(handles.every(record => record.closeCalls === 1 && record.closeEvents === 1), 'Every native handle must close exactly once')
    },
    async emergencyClose() {
      const open = handles.filter(record => record.closeEvents === 0)
      for (const record of open) {
        record.native.close()
      }
      await bounded(Promise.all(open.map(record => record.closed)), 'diagnostic cleanup of exact native handles')
      return open.map(record => record.path)
    },
    snapshot() {
      return { attempts, injected, handles: handles.map(({ path: file, closeCalls, closeEvents }) => ({ file, closeCalls, closeEvents })) }
    },
    restore() {
      for (const restore of restoreEvents) {
        restore()
      }
      fs.watch = original
      syncBuiltinESMExports()
    },
  }
}
