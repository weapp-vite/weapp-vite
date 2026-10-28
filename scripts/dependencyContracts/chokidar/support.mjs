import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs'
import promises from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { observeFileListeners } from './eventPhase.mjs'
import { assertNativeWatcherClosed, closeDarwinRegistrationBarrier, observeNativeWatcher } from './nativeWatcher.mjs'
import { createPollingScheduler } from './pollingScheduler.mjs'

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

/** 仅把 Windows 原生 namespace 拼写还原为同一逻辑路径；调用参数与原错误保持原样。 */
export function normalizeNativeWatchPath(value) {
  const file = value instanceof URL ? fileURLToPath(value) : String(value)
  if (file.startsWith('\\\\?\\UNC\\')) {
    return `\\\\${file.slice(8)}`
  }
  return file.startsWith('\\\\?\\') ? file.slice(4) : file
}

export function absolutePath(value) {
  return path.resolve(normalizeNativeWatchPath(value))
}

export function installNativeInstrumentation({
  root,
  platform,
  beforeWatch = /** @type {((file: string, attempt: {path: string, afterPublicClose: boolean, result: string}) => void) | undefined} 可选的注册前观察钩子。 */ (undefined),
  promiseHooks = {},
}) {
  const actualPlatform = process.platform
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const originalWatch = fs.watch
  const originalWatchFile = fs.watchFile
  const originalUnwatchFile = fs.unwatchFile
  const originalPromises = new Map()
  const handles = []
  const registrationBarriers = []
  const nativeEvents = []
  let omittedNativeEvents = 0
  const pollingHandles = []
  const pollingReleases = []
  const polling = createPollingScheduler()
  const recursiveScopes = new AsyncLocalStorage()
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
      const recursive = args.some(value => value && typeof value === 'object' && value.recursive === true)
      const parent = recursiveScopes.getStore()
      const childScope = recursive ? { children: [], lateAcquisitions: [], closing: false } : undefined
      const acquire = () => originalWatch.call(this, filename, ...args)
      const native = childScope ? recursiveScopes.run(childScope, acquire) : acquire()
      const record = observeNativeWatcher(native, { path: relative(file), afterPublicClose: publicCloseStarted, recursiveScope: childScope })
      handles.push(record)
      parent?.children.push(record)
      if (parent?.closing) {
        parent.lateAcquisitions.push(record.path)
      }
      native.prependListener('change', (eventType, filename) => {
        if (nativeEvents.length < 128) {
          nativeEvents.push({ path: relative(file), eventType, filename: filename == null ? null : String(filename).replaceAll('\\', '/'), afterPublicClose: publicCloseStarted })
        }
        else { omittedNativeEvents++ }
      })
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
  for (const method of new Set(['stat', ...Object.keys(promiseHooks)])) {
    const hook = promiseHooks[method]
    const original = promises[method]
    originalPromises.set(method, original)
    promises[method] = function (...args) {
      const file = absolutePath(args[0])
      const invoke = () => hook
        ? hook({ file, args, original: (...override) => original.apply(this, override.length ? override : args) })
        : original.apply(this, args)
      return method === 'stat' ? polling.observeStat(file, invoke) : invoke()
    }
  }
  syncBuiltinESMExports()
  return {
    actualPlatform,
    selectedPlatform: process.platform,
    handles,
    pollingHandles,
    polling,
    attempts,
    markPublicClose() { publicCloseStarted = true },
    async settleDirectoryRegistration(timeoutMs) {
      const barrier = closeDarwinRegistrationBarrier({
        actualPlatform,
        directory: root,
        watch: directory => originalWatch.call(fs, directory),
        register: record => registrationBarriers.push(record),
      })
      if (barrier) {
        await bounded(barrier.closePromise, 'exact Darwin registration barrier native close', timeoutMs)
        assertNativeWatcherClosed(barrier, true)
      }
    },
    async assertAllClosed(timeoutMs, exactlyOnce = false) {
      await bounded(Promise.all([...handles, ...registrationBarriers].map(record => record.closePromise)), 'all exact native fs.watch close completions', timeoutMs)
      for (const record of handles) {
        assertNativeWatcherClosed(record, exactlyOnce)
      }
      for (const record of registrationBarriers) {
        assertNativeWatcherClosed(record, true)
      }
      await bounded(Promise.all(pollingHandles.map(record => record.stopPromise)), 'all exact native fs.watchFile stop events', timeoutMs)
      assert.equal(pollingHandles.filter(record => !record.stopped).length, 0, 'public close must stop every acquired polling watcher')
      await polling.assertAllClosed(timeoutMs)
    },
    async emergencyClose(timeoutMs) {
      const outstanding = [...handles, ...registrationBarriers].filter(record => !record.closed)
      const pollingOutstanding = pollingHandles.filter(record => !record.stopped)
      for (const record of outstanding) {
        record.native.close()
      }
      for (const record of pollingOutstanding) {
        originalUnwatchFile(record.absolute, record.listener)
      }
      await bounded(Promise.all(outstanding.map(record => record.closePromise)), 'exact diagnostic handle cleanup', timeoutMs)
      await bounded(Promise.all(pollingOutstanding.map(record => record.stopPromise)), 'exact diagnostic polling cleanup', timeoutMs)
      const schedulerOutstanding = await polling.emergencyClose(timeoutMs)
      return [...outstanding.map(record => record.path), ...pollingOutstanding.map(record => `polling:${record.path}`), ...schedulerOutstanding]
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
        nativeEvents,
        omittedNativeEvents,
        registrationBarriers: registrationBarriers.map(({ purpose, closed, closeCalls, closeEvents, nativeCloseRequests, nativeCloseCompletions, termination, errorEvents }) => ({ purpose, closed, closeCalls, closeEvents, nativeCloseRequests, nativeCloseCompletions, termination, errorEvents })),
        handles: handles.map(({ path: watchedPath, kind, recursiveScope, closed, closeCalls, closeEvents, nativeCloseRequests, nativeCloseCompletions, nativeCloseOrigin, errorEvents, termination, observationErrors, afterPublicClose, lastError }) => ({
          path: watchedPath,
          kind: kind || 'native-handle',
          recursiveChildren: recursiveScope?.children.map(child => ({ path: child.path, closed: child.closed, nativeCloseRequests: child.nativeCloseRequests, nativeCloseCompletions: child.nativeCloseCompletions })),
          lateAcquisitions: recursiveScope?.lateAcquisitions,
          closed,
          closeCalls,
          closeEvents,
          nativeCloseRequests,
          nativeCloseCompletions,
          nativeCloseOrigin,
          errorEvents,
          termination,
          observationErrors: observationErrors.map(error => String(error)),
          afterPublicClose,
          lastError,
        })),
        pollingHandles: pollingHandles.map(({ path: watchedPath, stopped, afterPublicClose }) => ({ path: watchedPath, stopped, afterPublicClose })),
        pollingReleases,
        scheduler: polling.snapshot(root),
      }
    },
  }
}

export function observeWatcher(chokidar, root, watchedPaths, options = {}, instrumentation) {
  const watcher = new chokidar.FSWatcher({ persistent: true, backend: 'native', atomic: false, ...options }, instrumentation?.polling.scheduler)
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
  if (instrumentation) {
    const paths = (Array.isArray(watchedPaths) ? watchedPaths : [watchedPaths]).map(file => path.resolve(options.cwd || process.cwd(), file))
    instrumentation.polling.withPaths(paths, () => watcher.add(watchedPaths))
  }
  else { watcher.add(watchedPaths) }
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
      let failure
      const event = new Promise((resolve, reject) => {
        listener = (actualEvent, file, stats) => {
          const actual = path.resolve(options.cwd || process.cwd(), String(file))
          if (actualEvent === eventName && actual === absolute && predicate(stats)) {
            resolve({ event: actualEvent, path: expected })
          }
        }
        watcher.on('all', listener)
        failure = reject
        watcher.on('error', failure)
      })
      const awaited = bounded(event, `${eventName} ${expected}`, timeoutMs).finally(() => {
        watcher.off('all', listener)
        watcher.off('error', failure)
      })
      awaited.catch(() => {})
      return awaited
    },
  }
}
