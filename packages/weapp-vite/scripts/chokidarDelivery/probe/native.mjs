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
export function instrumentNative(root, injection) {
  const original = fs.watch
  const handles = []
  const attempts = []
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
    if (injection && injected === 0 && file === injection.target) {
      injected++
      if (injection.missing) {
        fs.rmSync(file, { recursive: true })
      }
      throw injection.error
    }
    const native = original.call(this, filename, ...args)
    let resolveClose
    const closed = new Promise((resolve) => {
      resolveClose = resolve
    })
    const record = { file, path: label, native, closeCalls: 0, closeEvents: 0, closed }
    const close = native.close
    native.close = function (...closeArgs) {
      record.closeCalls++
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
      fs.watch = original
      syncBuiltinESMExports()
    },
  }
}
