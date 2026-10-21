import assert from 'node:assert/strict'
import fs from 'node:fs'
import promises from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { observeFileListeners } from './eventPhase.mjs'

export { waitForObservedEventPhase } from './eventPhase.mjs'

export function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolve_, reject_) => {
    resolve = resolve_
    reject = reject_
  })
  return { promise, resolve, reject }
}

export function bounded(promise, label, timeoutMs) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Deadline exceeded: ${label}`)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

export const turn = () => new Promise(resolve => setImmediate(resolve))

export function absolutePath(value) {
  const file = value instanceof URL ? fileURLToPath(value) : String(value)
  return path.resolve(file)
}

export function installNativeInstrumentation({ root, platform, beforeWatch, promiseHooks = {} }) {
  const actualPlatform = process.platform
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const originalWatch = fs.watch
  const originalWatchFile = fs.watchFile
  const originalUnwatchFile = fs.unwatchFile
  const originalPromises = new Map()
  const handles = []
  const pollingHandles = []
  const pollingReleases = []
  const attempts = []
  let publicCloseStarted = false
  let restored = false
  const relative = file => path.relative(root, file).replaceAll('\\', '/') || '.'
  if (platform !== 'native') {
    Object.defineProperty(process, 'platform', { ...platformDescriptor, value: platform })
  }
  fs.watch = function (filename, ...args) {
    const file = absolutePath(filename)
    const attempt = { path: relative(file), afterPublicClose: publicCloseStarted, result: 'pending' }
    attempts.push(attempt)
    try {
      beforeWatch?.(file, attempt)
      const native = originalWatch.call(this, filename, ...args)
      const closed = deferred()
      const record = { path: relative(file), native, closed: false, closeCalls: 0, closeEvents: 0, closePromise: closed.promise, afterPublicClose: publicCloseStarted }
      const originalClose = native.close
      native.close = function (...closeArgs) {
        record.closeCalls++
        return originalClose.apply(this, closeArgs)
      }
      native.once('close', () => {
        record.closeEvents++
        record.closed = true
        closed.resolve()
      })
      native.on('error', (error) => {
        record.lastError = { code: error.code, message: error.message }
      })
      handles.push(record)
      attempt.result = 'acquired'
      return native
    }
    catch (error) {
      attempt.result = 'threw'
      attempt.code = error.code
      throw error
    }
  }
  fs.watchFile = function (filename, ...args) {
    const file = absolutePath(filename)
    const listener = args.findLast(value => typeof value === 'function')
    const native = originalWatchFile.call(this, filename, ...args)
    const stopped = deferred()
    const record = { path: relative(file), absolute: file, listener, native, stopped: false, stopPromise: stopped.promise, afterPublicClose: publicCloseStarted }
    native.once('stop', () => {
      record.stopped = true
      stopped.resolve()
    })
    pollingHandles.push(record)
    return native
  }
  fs.unwatchFile = function (filename, ...args) {
    pollingReleases.push({ path: relative(absolutePath(filename)), exactListener: typeof args[0] === 'function' })
    return originalUnwatchFile.call(this, filename, ...args)
  }
  for (const [method, hook] of Object.entries(promiseHooks)) {
    const original = promises[method]
    originalPromises.set(method, original)
    promises[method] = function (...args) {
      return hook({ file: absolutePath(args[0]), args, original: (...override) => original.apply(this, override.length ? override : args) })
    }
  }
  syncBuiltinESMExports()
  return {
    actualPlatform,
    selectedPlatform: process.platform,
    handles,
    pollingHandles,
    attempts,
    markPublicClose() { publicCloseStarted = true },
    async assertAllClosed(timeoutMs, exactlyOnce = false) {
      await bounded(Promise.all(handles.map(record => record.closePromise)), 'all exact native fs.watch close events', timeoutMs)
      assert.equal(handles.filter(record => !record.closed).length, 0, 'public close must terminate every acquired native handle')
      if (exactlyOnce) {
        assert.ok(handles.every(record => record.closeCalls === 1 && record.closeEvents === 1), 'each acquired native handle closes exactly once, including repeated public close')
      }
      await bounded(Promise.all(pollingHandles.map(record => record.stopPromise)), 'all exact native fs.watchFile stop events', timeoutMs)
      assert.equal(pollingHandles.filter(record => !record.stopped).length, 0, 'public close must stop every acquired polling watcher')
    },
    async emergencyClose(timeoutMs) {
      const outstanding = handles.filter(record => !record.closed)
      const pollingOutstanding = pollingHandles.filter(record => !record.stopped)
      for (const record of outstanding) {
        record.native.close()
      }
      for (const record of pollingOutstanding) {
        originalUnwatchFile(record.absolute, record.listener)
      }
      await bounded(Promise.all(outstanding.map(record => record.closePromise)), 'exact diagnostic handle cleanup', timeoutMs)
      await bounded(Promise.all(pollingOutstanding.map(record => record.stopPromise)), 'exact diagnostic polling cleanup', timeoutMs)
      return [...outstanding.map(record => record.path), ...pollingOutstanding.map(record => `polling:${record.path}`)]
    },
    restore() {
      if (restored) {
        return
      }
      restored = true
      fs.watch = originalWatch
      fs.watchFile = originalWatchFile
      fs.unwatchFile = originalUnwatchFile
      for (const [method, original] of originalPromises) {
        promises[method] = original
      }
      Object.defineProperty(process, 'platform', platformDescriptor)
      syncBuiltinESMExports()
    },
    snapshot() {
      return {
        actualPlatform,
        selectedPlatform: platform === 'native' ? actualPlatform : platform,
        attempts,
        handles: handles.map(({ path: watchedPath, closed, closeCalls, closeEvents, afterPublicClose, lastError }) => ({ path: watchedPath, closed, closeCalls, closeEvents, afterPublicClose, lastError })),
        pollingHandles: pollingHandles.map(({ path: watchedPath, stopped, afterPublicClose }) => ({ path: watchedPath, stopped, afterPublicClose })),
        pollingReleases,
      }
    },
  }
}

export function observeWatcher(chokidar, root, watchedPaths, options = {}) {
  const watcher = new chokidar.FSWatcher({ persistent: true, usePolling: false, atomic: false, ...options })
  const eventPhases = observeFileListeners(watcher)
  const events = []
  const errors = []
  const ready = deferred()
  let readyCount = 0
  watcher.on('all', (event, file) => {
    const absolute = path.resolve(options.cwd || process.cwd(), String(file))
    events.push({ event, path: path.relative(root, absolute).replaceAll('\\', '/') || '.', rawPath: String(file) })
  })
  watcher.on('error', error => errors.push(error))
  watcher.on('ready', () => {
    readyCount++
    ready.resolve()
  })
  watcher.add(watchedPaths)
  return {
    watcher,
    eventPhases,
    events,
    errors,
    ready: ready.promise,
    get readyCount() { return readyCount },
    /**
     * 等待精确路径的后续事件，可用文件状态谓词拒绝旧观察结果。
     * @param {string} eventName 事件名。
     * @param {string} absolute 目标绝对路径。
     * @param {number} timeoutMs 本次等待预算。
     * @param {(stats: import('node:fs').Stats | undefined) => boolean} [predicate] 目标文件状态谓词。
     */
    event(eventName, absolute, timeoutMs, predicate = () => true) {
      const expected = path.relative(root, absolute).replaceAll('\\', '/') || '.'
      let listener
      const event = new Promise((resolve) => {
        listener = (actualEvent, file, stats) => {
          const actual = path.resolve(options.cwd || process.cwd(), String(file))
          if (actualEvent === eventName && actual === absolute && predicate(stats)) {
            resolve({ event: actualEvent, path: expected })
          }
        }
        watcher.on('all', listener)
      })
      const awaited = bounded(event, `${eventName} ${expected}`, timeoutMs).finally(() => watcher.off('all', listener))
      awaited.catch(() => {})
      return awaited
    },
  }
}
