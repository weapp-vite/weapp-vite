import { Buffer } from 'node:buffer'
import { watch as nativeWatch } from 'node:fs'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import { bounded, requireFact, safeError, sha256 } from './support.mjs'

export async function observePhase(createServer, requestedDelayMs, context) {
  const { report, cancellation } = context
  const result = { requestedDelayMs, observationMs: 200, outcome: 'incomplete', events: [], droppedRows: 0, cleanup: {} }
  report.phases.push(result)
  const controller = new AbortController()
  const signal = controller.signal
  const forwardAbort = () => controller.abort(cancellation.signal.reason)
  cancellation.signal.addEventListener('abort', forwardAbort, { once: true })
  if (cancellation.signal.aborted) {
    forwardAbort()
  }
  const original = 'original-source\n'
  const updated = 'updated-source-with-different-size\n'
  result.sourceHashes = { original: sha256(original), updated: sha256(updated) }
  let owned, target, native, server, descriptor, originalThrottle, wrappedThrottle
  let phase = 'setup'
  let failed
  const removers = []
  const record = (kind, data = {}, atMs = performance.now()) => {
    if (result.events.length < 400) {
      result.events.push({ kind, phase, atMs, ...data })
    }
    else {
      result.droppedRows++
    }
    return atMs
  }
  const listen = (emitter, event, callback) => {
    emitter.on(event, callback)
    removers.push({ emitter, event, remove: () => emitter.off(event, callback) })
  }
  const onError = (error) => {
    record('watcher:error', safeError(error))
    controller.abort(error)
  }
  try {
    signal.throwIfAborted()
    owned = await mkdtemp(path.join(tmpdir(), 'vite-watcher-throttle-'))
    const ownedReal = await realpath(owned)
    target = path.join(owned, 'fixture.txt')
    const targetReal = path.join(ownedReal, 'fixture.txt')
    const observed = (file, base = owned) => {
      const absolute = path.resolve(base, file)
      const relative = path.relative(owned, absolute)
      return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? path.resolve(ownedReal, relative) : absolute
    }
    const matches = (file, details) => typeof file === 'string' && (observed(file) === targetReal
      || (typeof details?.watchedPath === 'string' && (observed(file, details.watchedPath) === targetReal
        || (observed(details.watchedPath) === targetReal && file === 'fixture.txt'))))
    await writeFile(target, original)
    native = nativeWatch(target, { persistent: false })
    listen(native, 'change', event => record('native:raw', { event }))
    listen(native, 'error', onError)
    server = await createServer({ root: owned, configFile: false, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: { usePolling: false, useFsEvents: false, awaitWriteFinish: false } } })
    signal.throwIfAborted()
    const watcher = server.watcher
    result.resolvedOptions = Object.fromEntries(['usePolling', 'useFsEvents', 'interval', 'awaitWriteFinish', 'atomic'].map(key => [key, watcher.options[key]]))
    requireFact(watcher.options.usePolling === false && watcher.options.useFsEvents === false && watcher.options.awaitWriteFinish === false, 'WATCHER_BACKEND_MISMATCH')
    requireFact(typeof watcher._throttle === 'function', 'THROTTLE_UNAVAILABLE')
    descriptor = Object.getOwnPropertyDescriptor(watcher, '_throttle')
    originalThrottle = watcher._throttle
    result.throttleImplementationSha256 = sha256(Function.prototype.toString.call(originalThrottle))
    wrappedThrottle = function (action, file, milliseconds) {
      const atMs = performance.now()
      const returned = Reflect.apply(originalThrottle, this, [action, file, milliseconds])
      if (matches(file) && (action === 'change' || action === 'watch')) {
        record('throttle', { action, timeoutMs: milliseconds, accepted: returned !== false }, atMs)
      }
      return returned
    }
    watcher._throttle = wrappedThrottle
    listen(watcher, 'error', onError)
    listen(watcher, 'raw', (event, file, details) => {
      if (matches(file, details)) {
        record('chokidar:raw', { event })
      }
    })
    let firstAt
    let resolveFirst
    const firstChange = new Promise((resolve) => {
      resolveFirst = resolve
    })
    listen(watcher, 'change', (file) => {
      if (!matches(file)) {
        return
      }
      const atMs = record('chokidar:change')
      if (phase === 'update' && firstAt === undefined) {
        firstAt = atMs
        resolveFirst(atMs)
      }
    })
    if (!watcher._readyEmitted) {
      const ready = new Promise(resolve => listen(watcher, 'ready', resolve))
      await bounded(ready, 3000, 'WATCHER_READY_TIMEOUT', signal)
    }
    const write = async (nextPhase, content) => {
      signal.throwIfAborted()
      phase = nextPhase
      const atMs = record('write:begin', { bytes: Buffer.byteLength(content) })
      await writeFile(target, content)
      record('write:end')
      return atMs
    }
    await write('update', updated)
    await bounded(firstChange, 2000, 'FIRST_CHANGE_TIMEOUT', signal)
    // 受控输入只存在于独立诊断，不修改正式 Web 验收的写入节奏。
    await delay(Math.max(0, requestedDelayMs - (performance.now() - firstAt)), undefined, { signal })
    const restoreAt = await write('restore', original)
    await delay(200, undefined, { signal })
    const observationEnd = record('observation:end')
    const bytes = await readFile(target)
    signal.throwIfAborted()
    result.sourceHashes.final = sha256(bytes)
    result.finalSourceRestored = bytes.equals(Buffer.from(original))
    result.firstChangeToRestoreWriteMs = restoreAt - firstAt
    result.restoreWriteToObservationEndMs = observationEnd - restoreAt
    const after = result.events.filter(event => event.atMs >= restoreAt && event.atMs <= observationEnd)
    const fifty = event => event.kind === 'throttle' && event.action === 'change' && event.timeoutMs === 50
    const update50 = result.events.find(event => event.phase === 'update' && fifty(event) && event.accepted)
    const restore50 = after.find(fifty)
    result.restoreFirst50 = restore50 ? { accepted: restore50.accepted, gapFromUpdate50Ms: restore50.atMs - (update50?.atMs ?? Number.NaN) } : null
    result.rawAfterRestore = after.filter(event => event.kind === 'chokidar:raw').length
    result.nativeRawAfterRestore = after.filter(event => event.kind === 'native:raw').length
    result.changesAfterRestore = after.filter(event => event.kind === 'chokidar:change').length
    result.rejected50 = after.filter(event => fifty(event) && !event.accepted).length
    result.rejected5 = after.filter(event => event.kind === 'throttle' && event.action === 'watch' && event.timeoutMs === 5 && !event.accepted).length
    const gap = result.restoreFirst50?.gapFromUpdate50Ms
    const measured = !result.droppedRows && result.finalSourceRestored && result.rawAfterRestore > 0 && update50 && restore50
    result.outcome = 'inconclusive-window-or-evidence-incomplete'
    if (requestedDelayMs === 20 && measured && result.firstChangeToRestoreWriteMs > 5 && result.firstChangeToRestoreWriteMs < 50 && gap > 5 && gap < 50 && !restore50.accepted) {
      result.outcome = result.changesAfterRestore ? 'observed-50ms-suppression-with-later-change' : 'observed-50ms-suppression-without-trailing-change'
    }
    if (requestedDelayMs === 80 && measured && result.firstChangeToRestoreWriteMs >= 50 && gap >= 50 && restore50.accepted && result.changesAfterRestore > 0) {
      result.outcome = 'control-change-observed-outside-50ms'
    }
  }
  catch (error) {
    failed = error
    result.error = { phase, ...safeError(error) }
  }
  finally {
    phase = 'cleanup'
    // 分别尝试全部自有资源，保留首错；失败时不进入下一 phase。
    const cleanup = async (name, run) => {
      try {
        await run()
        result.cleanup[name] = true
      }
      catch (error) {
        result.cleanup[name] = safeError(error)
        failed ??= error
        context.forceOwnProcessExit = true
      }
    }
    if (target && !result.sourceHashes.final) {
      try {
        const bytes = await readFile(target)
        result.sourceHashes.final = sha256(bytes)
        result.finalSourceRestored = bytes.equals(Buffer.from(original))
      }
      catch (error) {
        result.finalSourceReadError = safeError(error)
      }
    }
    if (server && wrappedThrottle) {
      await cleanup('throttleRestored', async () => {
        requireFact(server.watcher._throttle === wrappedThrottle, 'THROTTLE_IDENTITY_CHANGED')
        if (descriptor) {
          Object.defineProperty(server.watcher, '_throttle', descriptor)
        }
        else {
          delete server.watcher._throttle
        }
        requireFact(server.watcher._throttle === originalThrottle, 'THROTTLE_RESTORE_FAILED')
      })
    }
    if (native) {
      await cleanup('nativeClosed', async () => {
        let closed
        const pending = new Promise((resolve) => {
          closed = resolve
          native.once('close', closed)
        })
        try {
          native.close()
          await bounded(pending, 3000, 'NATIVE_CLOSE_TIMEOUT')
        }
        finally {
          native.off('close', closed)
        }
      })
    }
    if (server) {
      await cleanup('serverClosed', () => bounded(Promise.resolve().then(() => server.close()), 3000, 'SERVER_CLOSE_TIMEOUT'))
    }
    let retainedErrorListeners = 0
    for (const entry of removers) {
      const closed = entry.emitter === native ? result.cleanup.nativeClosed : result.cleanup.serverClosed
      if (entry.event === 'error' && closed !== true) {
        retainedErrorListeners++
      }
      else {
        entry.remove()
      }
    }
    result.cleanup.listenersRemoved = retainedErrorListeners === 0
    result.cleanup.retainedErrorListenersUntilOwnExit = retainedErrorListeners
    if (owned && !context.forceOwnProcessExit) {
      await cleanup('fixtureRemoved', () => rm(owned, { recursive: true, force: true }))
    }
    cancellation.signal.removeEventListener('abort', forwardAbort)
    result.cleanup.abortListenerRemoved = true
    if (signal.aborted && !failed) {
      failed = signal.reason
      result.error = { phase, ...safeError(failed) }
    }
    if (failed) {
      result.outcome = 'diagnostic-failed'
    }
  }
  if (failed) {
    throw failed
  }
}
