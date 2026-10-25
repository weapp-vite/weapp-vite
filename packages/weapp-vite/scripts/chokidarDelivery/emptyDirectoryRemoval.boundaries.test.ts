import type { FSWatcher as NativeWatcher, PathLike } from 'node:fs'
import type { Readable } from 'node:stream'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { FSWatcher } from 'chokidar'
import { expect, it, vi } from 'vitest'
import { assertNativeWatcherClosed, observeNativeWatcher } from '../../../../scripts/dependencyContracts/chokidar/nativeWatcher.mjs'
import { absolutePath } from '../../../../scripts/dependencyContracts/chokidar/support.mjs'

interface DirectoryEntry {
  getChildren: () => string[]
  items: Set<string>
}

interface InternalWatcher {
  handler: {
    readDirectory: (...args: unknown[]) => Promise<unknown> | undefined
  }
  createScanStream: (directory: string, options: unknown) => Readable | undefined
  tree: { watched: Map<string, DirectoryEntry> }
  lifecycle: { closers: Map<string, unknown> }
  streams: Set<Readable>
}

interface DirectoryRead {
  watcher: FSWatcher
  internal: InternalWatcher
  directory: string
  entry: DirectoryEntry
  closer: unknown
  stream: PassThrough
  completion: Promise<unknown>
  events: Array<{ event: string, file: string }>
  errors: unknown[]
}

function key(directory: string) {
  return path.resolve(directory).replaceAll('\\', '/')
}

function bounded<T>(promise: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Directory warning boundary did not complete: ${label}`)), 5000)
    }),
  ]).finally(() => clearTimeout(timer))
}

/** 真实 watcher 登记后仅替换本次扫描流，保留目录归属、closer 与原生句柄。 */
async function withDirectoryRead(exercise: (read: DirectoryRead) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), 'chokidar-directory-boundary-'))
  const watched = path.join(root, 'src')
  const directory = path.join(watched, 'deep')
  const native: Array<ReturnType<typeof observeNativeWatcher>> = []
  const originalWatch = fs.watch
  const absolute = (value: PathLike) => absolutePath(value)
  const interception = vi.spyOn(fs, 'watch').mockImplementation(function (this: unknown, filename: PathLike, ...args: unknown[]) {
    const handle = Reflect.apply(originalWatch, this, [filename, ...args]) as NativeWatcher
    const file = absolute(filename)
    const relative = path.relative(root, file)
    if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))) {
      native.push(observeNativeWatcher(handle, { path: relative.replaceAll('\\', '/'), afterPublicClose: false }))
    }
    return handle
  } as typeof fs.watch)
  syncBuiltinESMExports()
  const watcher = new FSWatcher({ persistent: false, backend: 'native', atomic: false })
  const internal = watcher as unknown as InternalWatcher
  const handler = internal.handler
  const originalRead = handler.readDirectory
  const originalReaddirp = internal.createScanStream
  const events: DirectoryRead['events'] = []
  const errors: unknown[] = []
  const stream = new PassThrough({ objectMode: true })
  let initialArguments: unknown[] | undefined
  let cleanupConfirmed = false
  watcher.on('all', (event, file) => events.push({ event, file: path.resolve(file) }))
  watcher.on('error', error => errors.push(error))
  handler.readDirectory = function (...args) {
    if (absolutePath(args[0]) === directory && !initialArguments) {
      initialArguments = args
    }
    return Reflect.apply(originalRead, this, args) as Promise<unknown> | undefined
  }
  try {
    await mkdir(directory, { recursive: true })
    const ready = once(watcher, 'ready')
    watcher.add(watched)
    await bounded(ready, 'initial public ready')
    assert.ok(initialArguments, 'The real directory registration supplies its original ownership predicates')
    const entry = internal.tree.watched.get(key(directory))
    const closer = internal.lifecycle.closers.get(key(directory))
    assert.ok(entry)
    assert.ok(closer)
    expect(entry.getChildren()).toEqual([])
    events.length = 0
    handler.readDirectory = originalRead
    internal.createScanStream = function (file, options) {
      if (path.resolve(file) !== directory) {
        return Reflect.apply(originalReaddirp, this, [file, options]) as Readable | undefined
      }
      // 保留真实 createScanStream 的登记与终结职责，close 必须取消本次受控扫描。
      internal.streams.add(stream)
      const finalize = () => internal.streams.delete(stream)
      stream.once('close', finalize).once('end', finalize).once('error', finalize)
      return stream
    }
    const completion = Reflect.apply(originalRead, handler, initialArguments) as Promise<unknown> | undefined
    assert.ok(completion, 'The controlled scan entered the original directory reader')
    await exercise({ watcher, internal, directory, entry, closer, stream, completion, events, errors })
  }
  finally {
    try {
      await bounded(watcher.close(), 'public owner close')
      await bounded(Promise.all(native.map(record => record.closePromise)), 'all exact native close completions')
      for (const record of native) {
        assertNativeWatcherClosed(record)
      }
      cleanupConfirmed = true
    }
    finally {
      stream.destroy()
      handler.readDirectory = originalRead
      internal.createScanStream = originalReaddirp
      interception.mockRestore()
      syncBuiltinESMExports()
      if (cleanupConfirmed) {
        await rm(root, { recursive: true, force: true })
      }
    }
  }
}

function warning(code: string, file?: string): NodeJS.ErrnoException {
  return Object.assign(new Error('controlled directory scan warning'), {
    code,
    syscall: 'scandir',
    ...(file === undefined ? {} : { path: file }),
  })
}

function expectUnchanged(read: DirectoryRead, entry = read.entry) {
  expect(read.internal.tree.watched.get(key(read.directory))).toBe(entry)
  expect(read.internal.lifecycle.closers.get(key(read.directory))).toBe(read.closer)
  expect(Object.hasOwn(read.watcher.getWatched(), read.directory)).toBe(true)
  expect(read.events).toEqual([])
  expect(read.errors).toEqual([])
}

it.each([
  { name: '根目录仍存在的 ENOENT', code: 'ENOENT', path: 'root' },
  { name: '子项 ENOENT', code: 'ENOENT', path: 'child' },
  { name: '根目录 EACCES', code: 'EACCES', path: 'root' },
  { name: '根目录 EPERM', code: 'EPERM', path: 'root' },
  { name: '缺少 path 的 ENOENT', code: 'ENOENT', path: 'missing' },
])('$name 不会误删仍归属当前 watcher 的目录', async (scenario) => {
  await withDirectoryRead(async (read) => {
    const file = scenario.path === 'child'
      ? path.join(read.directory, 'missing-child')
      : scenario.path === 'root' ? read.directory : undefined
    const originalWarning = warning(scenario.code, file)
    const observed: unknown[] = []
    read.stream.on('warn', error => observed.push(error))
    read.stream.emit('warn', originalWarning)
    read.stream.end()
    await bounded(read.completion, 'warning scan completion')
    expect(observed).toEqual([originalWarning])
    expect(observed[0]).toBe(originalWarning)
    expectUnchanged(read)
  })
}, 20_000)

it('旧扫描的根 ENOENT 不会删除已经替换的新目录 entry', async () => {
  await withDirectoryRead(async (read) => {
    // 沿用真实 DirEntry 原型与字段，仅建立独立身份，模拟新一代已经接管同一路径。
    const replacement = Object.assign(Object.create(Object.getPrototypeOf(read.entry)), read.entry, {
      items: new Set(read.entry.items),
    }) as DirectoryEntry
    read.stream.emit('warn', warning('ENOENT', read.directory))
    read.internal.tree.watched.set(key(read.directory), replacement)
    read.stream.end()
    await bounded(read.completion, 'obsolete owner scan completion')
    expectUnchanged(read, replacement)
  })
}, 20_000)

it('关闭后的迟到根 ENOENT 和 end 不会重新登记或发布删除事件', async () => {
  await withDirectoryRead(async (read) => {
    await bounded(read.watcher.close(), 'close before late stream events')
    await bounded(read.completion, 'canceled scan completion')
    expect(read.stream.destroyed).toBe(true)
    const originalWarning = warning('ENOENT', read.directory)
    read.stream.emit('warn', originalWarning)
    read.stream.emit('end')
    expect(read.internal.tree.watched.size).toBe(0)
    expect(read.internal.lifecycle.closers.size).toBe(0)
    expect(read.watcher.getWatched()).toEqual({})
    expect(read.events).toEqual([])
    expect(read.errors).toEqual([])
  })
}, 20_000)
