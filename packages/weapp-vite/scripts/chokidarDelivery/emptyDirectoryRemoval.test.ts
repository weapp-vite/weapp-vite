import type { FSWatcher as NativeWatcher, PathLike } from 'node:fs'
import type { Readable } from 'node:stream'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { FSWatcher } from 'chokidar'
import { expect, it, vi } from 'vitest'
import { assertNativeWatcherClosed, closeDarwinRegistrationBarrier, observeNativeWatcher } from '../../../../scripts/dependencyContracts/chokidar/nativeWatcher.mjs'
import { absolutePath } from '../../../../scripts/dependencyContracts/chokidar/support.mjs'

interface InternalWatcher {
  handler: {
    readDirectory: (...args: unknown[]) => Promise<unknown> | undefined
    reconcileNativeTrigger: (...args: unknown[]) => Promise<unknown>
  }
  createScanStream: (directory: string, options: unknown) => Readable | undefined
  tree: { watched: Map<string, { getChildren: () => string[] }> }
  lifecycle: { closers: Map<string, unknown> }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

function key(directory: string) {
  return path.resolve(directory).replaceAll('\\', '/')
}

function bounded<T>(promise: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Empty-directory contract did not complete: ${label}`)), 5000)
    }),
  ]).finally(() => clearTimeout(timer))
}

function assertCleanupCompleted(bodyFailure: unknown, cleanupFailures: unknown[]) {
  if (cleanupFailures.length) {
    throw new AggregateError(bodyFailure === undefined ? cleanupFailures : [bodyFailure, ...cleanupFailures], 'Empty-directory native cleanup failed')
  }
}

/**
 * 从真实已登记的空目录出发，保留原生通知后删除目录，分别验证协调队列和真实扫描。
 * 扫描沿用初始登记的原始参数，父目录通知仍保留在队列，不能用另一条通知掩盖根目录清理。
 * 不伪造 fs 结果、stream 事件或 native callback；旧 child stat 主路径仍由正式依赖契约覆盖。
 */
it.each(['native', 'scan'] as const)('%s 真实根 ENOENT 会释放空目录自身的 tracking、closer 和原生句柄', async (mode) => {
  const root = await mkdtemp(path.join(tmpdir(), 'chokidar-empty-directory-'))
  const watched = path.join(root, 'src')
  const parent = path.join(watched, 'extra')
  const directory = path.join(parent, 'deep')
  const controlled = new Set([watched, parent, directory])
  const pending: Array<{ file: string, filename: string | undefined, deliver: () => unknown }> = []
  const queuedDirectory = deferred<void>()
  const native: Array<{ file: string, observation: ReturnType<typeof observeNativeWatcher> }> = []
  const registrationBarriers: Array<ReturnType<typeof observeNativeWatcher>> = []
  const errors: unknown[] = []
  const watcherFailure = Promise.withResolvers<never>()
  void watcherFailure.promise.catch(() => {})
  const removed = deferred<void>()
  const scanErrors: NodeJS.ErrnoException[] = []
  const reconciliations: Promise<unknown>[] = []
  const reconciliationEntered = deferred<void>()
  let initialArguments: unknown[] | undefined
  const startedAt = performance.now()
  const trace: Array<{ phase: string, file: string, values?: string[], elapsedMs: number }> = []
  let phase = 'subscribing'
  const record = (file: string, values?: unknown[]) => {
    if (trace.length < 64) {
      trace.push({
        phase,
        file: path.relative(root, file).replaceAll('\\', '/'),
        values: values?.map(value => String(value)),
        elapsedMs: performance.now() - startedAt,
      })
    }
  }
  const originalWatch = fs.watch
  const absolute = (value: PathLike) => absolutePath(value)
  const interception = vi.spyOn(fs, 'watch').mockImplementation(function (this: unknown, filename: PathLike, ...args: unknown[]) {
    const file = absolute(filename)
    if (controlled.has(file)) {
      const callbackIndex = args.findLastIndex(value => typeof value === 'function')
      assert.ok(callbackIndex >= 0, 'The real Chokidar subscription supplies its native callback')
      const callback = args[callbackIndex] as (...values: unknown[]) => unknown
      args[callbackIndex] = function (this: unknown, ...values: unknown[]) {
        record(file, values)
        // 从订阅开始就保留原生通知；ready/barrier 期间放行的扫描可能跨越后续写入并登记 queued.txt。
        // 初始枚举仍走真实 Chokidar，public ready 后仅交付删除后的指定通知。
        const filename = values[1] == null ? undefined : String(values[1])
        pending.push({ file, filename, deliver: callback.bind(this, ...values) })
        if (file === directory && filename === 'queued.txt') {
          queuedDirectory.resolve()
        }
      }
    }
    const handle = Reflect.apply(originalWatch, this, [filename, ...args]) as NativeWatcher
    if (controlled.has(file)) {
      const observation = observeNativeWatcher(handle, { path: path.relative(root, file).replaceAll('\\', '/'), afterPublicClose: false })
      native.push({ file, observation })
    }
    return handle
  } as typeof fs.watch)
  syncBuiltinESMExports()
  const watcher = new FSWatcher({ persistent: true, backend: 'native', atomic: false })
  const internal = watcher as unknown as InternalWatcher
  const originalRead = internal.handler.readDirectory
  const originalReconcile = internal.handler.reconcileNativeTrigger
  const originalReaddirp = internal.createScanStream
  internal.handler.readDirectory = function (...args) {
    if (absolutePath(args[0]) === directory && !initialArguments) {
      initialArguments = args
    }
    return Reflect.apply(originalRead, this, args) as Promise<unknown> | undefined
  }
  watcher.on('error', (error) => {
    errors.push(error)
    watcherFailure.reject(error)
  })
  watcher.on('unlinkDir', (file) => {
    if (path.resolve(file) === directory) {
      removed.resolve()
    }
  })
  let cleanupConfirmed = false
  let bodyFailure: unknown
  try {
    await mkdir(directory, { recursive: true })
    const ready = once(watcher, 'ready')
    watcher.add(watched)
    await bounded(ready, 'initial public ready')
    phase = 'ready'
    record(directory)
    expect(internal.tree.watched.get(key(directory))?.getChildren()).toEqual([])
    expect(internal.lifecycle.closers.has(key(directory))).toBe(true)
    const ownedNative = native.find(record => record.file === directory)
    assert.ok(ownedNative, 'The empty directory owns a real native handle before removal')
    phase = 'settling-native-registration'
    const barrier = closeDarwinRegistrationBarrier({
      actualPlatform: process.platform,
      directory: root,
      watch: (file: string) => Reflect.apply(originalWatch, fs, [file]) as NativeWatcher,
      register: (observation: ReturnType<typeof observeNativeWatcher>) => {
        registrationBarriers.push(observation)
        native.push({ file: root, observation })
      },
    })
    if (barrier) {
      await bounded(Promise.race([barrier.closePromise, watcherFailure.promise]), 'exact Darwin registration barrier native close')
      assertNativeWatcherClosed(barrier, true)
    }
    expect(errors).toEqual([])

    // 透明观察当前实例的真实读取，不替换 readdirp，也不增加 data listener。
    internal.createScanStream = function (file, options) {
      const stream = Reflect.apply(originalReaddirp, this, [file, options]) as Readable | undefined
      if (path.resolve(file) === directory) {
        stream?.on('warn', error => scanErrors.push(error as NodeJS.ErrnoException))
      }
      return stream
    }
    internal.handler.reconcileNativeTrigger = function (...args) {
      const result = Reflect.apply(originalReconcile, this, args) as Promise<unknown>
      if (absolutePath(args[0]) === directory && result) {
        reconciliations.push(result)
        reconciliationEntered.resolve()
      }
      return result
    }
    phase = 'writing'
    record(directory)
    await writeFile(path.join(directory, 'queued.txt'), 'a real notification held before directory removal')
    phase = 'written'
    record(directory)
    try {
      await bounded(Promise.race([queuedDirectory.promise, watcherFailure.promise]), 'real exact-directory native callback')
    }
    catch (error) {
      const nativeState = native.map(({ file, observation }) => ({
        file: path.relative(root, file).replaceAll('\\', '/'),
        closed: observation.closed,
        closeCalls: observation.closeCalls,
        errorEvents: observation.errorEvents,
        lastError: observation.lastError,
        observationErrors: observation.observationErrors.map((failure: Error) => failure.message),
      }))
      throw new Error(`Native callback evidence: ${JSON.stringify({ trace, errors: errors.map(error => error instanceof Error ? error.message : String(error)), nativeState })}`, { cause: error })
    }
    phase = 'removing'
    expect(internal.tree.watched.get(key(directory))?.getChildren()).toEqual([])
    await rm(parent, { recursive: true })
    const notification = pending.find(item => item.file === directory && item.filename === 'queued.txt')
    assert.ok(notification)
    if (mode === 'native') {
      notification.deliver()
      await bounded(reconciliationEntered.promise, 'queued original native callback entering reconciliation')
      await bounded(Promise.all(reconciliations), 'real missing-directory reconciliation completion')
    }
    else {
      assert.ok(initialArguments, 'The real initial directory scan supplies the ownership predicates')
      const scan = Reflect.apply(originalRead, internal.handler, initialArguments) as Promise<unknown> | undefined
      assert.ok(scan, 'The original directory reader creates a real missing-directory scan')
      await bounded(scan, 'real missing-directory scan completion')
      expect(scanErrors.some(error => error.code === 'ENOENT' && absolutePath(error.path) === directory)).toBe(true)
    }

    await bounded(removed.promise, 'public unlinkDir for the missing empty directory')
    expect(Object.hasOwn(watcher.getWatched(), directory)).toBe(false)
    expect(internal.tree.watched.has(key(directory))).toBe(false)
    expect(internal.tree.watched.get(key(parent))?.getChildren() ?? []).not.toContain('deep')
    expect(internal.lifecycle.closers.has(key(directory))).toBe(false)
    await bounded(ownedNative.observation.closePromise, 'exact removed-directory native close')
    expect(() => assertNativeWatcherClosed(ownedNative.observation)).not.toThrow()
    expect(errors).toEqual([])
  }
  catch (error) {
    bodyFailure = error
    throw error
  }
  finally {
    const cleanupFailures: unknown[] = []
    try {
      try {
        await bounded(watcher.close(), 'public owner close')
      }
      catch (error) { cleanupFailures.push(error) }
      for (const observation of registrationBarriers) {
        if (observation.native._handle) {
          try {
            observation.native.close()
          }
          catch (error) { cleanupFailures.push(error) }
        }
      }
      try {
        const closures = await bounded(Promise.allSettled(native.map(record => record.observation.closePromise)), 'all exact native close events')
        cleanupFailures.push(...closures.filter(result => result.status === 'rejected').map(result => result.reason))
      }
      catch (error) { cleanupFailures.push(error) }
      for (const record of native) {
        try {
          assertNativeWatcherClosed(record.observation)
        }
        catch (error) { cleanupFailures.push(error) }
      }
      cleanupConfirmed = cleanupFailures.length === 0
    }
    finally {
      pending.length = 0
      internal.handler.readDirectory = originalRead
      internal.handler.reconcileNativeTrigger = originalReconcile
      internal.createScanStream = originalReaddirp
      try {
        interception.mockRestore()
        syncBuiltinESMExports()
      }
      catch (error) { cleanupFailures.push(error) }
      if (cleanupConfirmed) {
        try {
          await rm(root, { recursive: true, force: true })
        }
        catch (error) { cleanupFailures.push(error) }
      }
      assertCleanupCompleted(bodyFailure, cleanupFailures)
    }
  }
}, 20_000)
