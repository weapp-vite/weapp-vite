import type { FSWatcher as NativeWatcher, PathLike } from 'node:fs'
import type { Readable } from 'node:stream'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FSWatcher } from 'chokidar'
import { expect, it, vi } from 'vitest'
import { assertNativeWatcherClosed, observeNativeWatcher } from '../../../../scripts/dependencyContracts/chokidar/nativeWatcher.mjs'

interface InternalWatcher {
  _nodeFsHandler: {
    _handleRead: (...args: unknown[]) => Promise<unknown> | undefined
  }
  _readdirp: (directory: string, options: unknown) => Readable | undefined
  _watched: Map<string, { getChildren: () => string[] }>
  _closers: Map<string, unknown>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
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

/**
 * 从真实已登记的空目录出发，排队同一原生 callback 后删除目录，再只交付该 callback。
 * 父目录通知保留在队列，避免靠另一条扫描路径掩盖根目录 ENOENT 未释放自身的缺口。
 * 不伪造 fs 结果、stream 事件或 native callback；旧 child stat 主路径仍由正式依赖契约覆盖。
 */
it('真实根 ENOENT 会释放空目录自身的 tracking、closer 和原生句柄', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'chokidar-empty-directory-'))
  const watched = path.join(root, 'src')
  const parent = path.join(watched, 'extra')
  const directory = path.join(parent, 'deep')
  const controlled = new Set([watched, parent, directory])
  const pending: Array<{ file: string, deliver: () => unknown }> = []
  const queuedDirectory = deferred<void>()
  const native: Array<{ file: string, observation: ReturnType<typeof observeNativeWatcher> }> = []
  const errors: Error[] = []
  const removed = deferred<void>()
  const warnings: NodeJS.ErrnoException[] = []
  const reads: Promise<unknown>[] = []
  let hold = false
  const originalWatch = fs.watch
  const absolute = (value: PathLike) => path.resolve(value instanceof URL ? fileURLToPath(value) : String(value))
  const interception = vi.spyOn(fs, 'watch').mockImplementation(function (this: unknown, filename: PathLike, ...args: unknown[]) {
    const file = absolute(filename)
    if (controlled.has(file)) {
      const callbackIndex = args.findLastIndex(value => typeof value === 'function')
      assert.ok(callbackIndex >= 0, 'The real Chokidar subscription supplies its native callback')
      const callback = args[callbackIndex] as (...values: unknown[]) => unknown
      args[callbackIndex] = function (this: unknown, ...values: unknown[]) {
        if (!hold) {
          return Reflect.apply(callback, this, values)
        }
        pending.push({ file, deliver: callback.bind(this, ...values) })
        if (file === directory) {
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
  const watcher = new FSWatcher({ persistent: true, usePolling: false, atomic: false })
  const internal = watcher as unknown as InternalWatcher
  const originalRead = internal._nodeFsHandler._handleRead
  const originalReaddirp = internal._readdirp
  watcher.on('error', error => errors.push(error))
  watcher.on('unlinkDir', (file) => {
    if (path.resolve(file) === directory) {
      removed.resolve()
    }
  })
  let cleanupConfirmed = false
  try {
    await mkdir(directory, { recursive: true })
    const ready = once(watcher, 'ready')
    watcher.add(watched)
    await bounded(ready, 'initial public ready')
    expect(internal._watched.get(directory)?.getChildren()).toEqual([])
    expect(internal._closers.has(directory)).toBe(true)
    const ownedNative = native.find(record => record.file === directory)
    assert.ok(ownedNative, 'The empty directory owns a real native handle before removal')

    // 透明观察当前实例的真实读取，不替换 readdirp，也不增加 data listener。
    internal._readdirp = function (file, options) {
      const stream = Reflect.apply(originalReaddirp, this, [file, options]) as Readable | undefined
      if (file === directory) {
        stream?.on('warn', error => warnings.push(error as NodeJS.ErrnoException))
      }
      return stream
    }
    internal._nodeFsHandler._handleRead = function (...args) {
      const result = Reflect.apply(originalRead, this, args) as Promise<unknown> | undefined
      if (args[0] === directory && result) {
        reads.push(result)
      }
      return result
    }
    hold = true
    await writeFile(path.join(directory, 'queued.txt'), 'a real notification held before directory removal')
    await bounded(queuedDirectory.promise, 'real exact-directory native callback')
    expect(internal._watched.get(directory)?.getChildren()).toEqual([])
    await rm(parent, { recursive: true })
    const notification = pending.find(item => item.file === directory)
    assert.ok(notification)
    notification.deliver()
    assert.ok(reads[0], 'The queued original native callback entered the real directory reader')
    await bounded(reads[0], 'real missing-directory readdirp completion')
    expect(warnings.some(error => error.code === 'ENOENT' && error.path === directory)).toBe(true)

    await bounded(removed.promise, 'public unlinkDir for the missing empty directory')
    expect(Object.hasOwn(watcher.getWatched(), directory)).toBe(false)
    expect(internal._watched.has(directory)).toBe(false)
    expect(internal._watched.get(parent)?.getChildren() ?? []).not.toContain('deep')
    expect(internal._closers.has(directory)).toBe(false)
    await bounded(ownedNative.observation.closePromise, 'exact removed-directory native close')
    expect(() => assertNativeWatcherClosed(ownedNative.observation)).not.toThrow()
    expect(errors).toEqual([])
  }
  finally {
    try {
      await bounded(watcher.close(), 'public owner close')
      await bounded(Promise.all(native.map(record => record.observation.closePromise)), 'all exact native close events')
      for (const record of native) {
        assertNativeWatcherClosed(record.observation)
      }
      cleanupConfirmed = true
    }
    finally {
      pending.length = 0
      internal._nodeFsHandler._handleRead = originalRead
      internal._readdirp = originalReaddirp
      interception.mockRestore()
      syncBuiltinESMExports()
      if (cleanupConfirmed) {
        await rm(root, { recursive: true, force: true })
      }
    }
  }
}, 20_000)
