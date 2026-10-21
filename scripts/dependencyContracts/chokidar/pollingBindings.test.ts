import type { Stats } from 'node:fs'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { NodeFsHandler } from 'chokidar/handler.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

type Listener = (current: Stats, previous: Stats) => void

const native = new Map<string, EventEmitter>()
const acquisitions: { file: string, options: fs.WatchFileOptions, listener: Listener, watcher: EventEmitter }[] = []
const closers: (() => void)[] = []
const file = path.resolve('polling-bindings', 'shared.json')
const otherFile = path.resolve('polling-bindings', 'other.json')

function stats(size: number) {
  return { size, mtimeMs: size } as Stats
}

function owner(interval: number, persistent = true, target = file) {
  const listener = vi.fn()
  const raw = vi.fn()
  const fsw = {
    options: { interval, binaryInterval: interval, persistent, usePolling: true },
    _getWatchedDir: () => ({ add: vi.fn() }),
    _handleError: vi.fn(),
    _emitRaw: raw,
  }
  const handler = new NodeFsHandler(fsw as unknown as ConstructorParameters<typeof NodeFsHandler>[0])
  const close = handler._watchWithNodeFs(target, listener)!
  closers.push(close)
  return { close, listener, raw }
}

beforeEach(() => {
  native.clear()
  acquisitions.length = 0
  vi.spyOn(fs, 'watchFile').mockImplementation(((target: string, options: fs.WatchFileOptions, listener: Listener) => {
    let watcher = native.get(target)
    if (!watcher) {
      native.set(target, watcher = new EventEmitter())
    }
    watcher.on('change', listener)
    acquisitions.push({ file: target, options, listener, watcher })
    return watcher
  }) as typeof fs.watchFile)
  vi.spyOn(fs, 'unwatchFile').mockImplementation(((target: string, listener?: Listener) => {
    expect(listener, 'release must identify the exact acquired native listener').toBeTypeOf('function')
    const watcher = native.get(target)
    watcher?.off('change', listener!)
    if (watcher?.listenerCount('change') === 0) {
      native.delete(target)
      watcher.emit('stop')
    }
  }) as typeof fs.unwatchFile)
  syncBuiltinESMExports()
})

afterEach(() => {
  for (const close of closers.splice(0)) {
    close()
  }
  vi.restoreAllMocks()
  syncBuiltinESMExports()
})

it.each([false, true])('keeps shared subscriptions and exact ownership after closing the upgrader first (%s)', (closeUpgrader) => {
  const slow = owner(120, false)
  const previous = acquisitions[0]
  const stopped = vi.fn()
  previous.watcher.once('stop', stopped)
  const fast = owner(100)
  const current = acquisitions[1]
  expect(current.options).toMatchObject({ interval: 100, persistent: true })
  expect(stopped).toHaveBeenCalledOnce()
  const sibling = owner(160)
  const other = owner(80, true, otherFile)
  expect(acquisitions.filter(item => item.file === file)).toHaveLength(2)
  const external = vi.fn()
  fs.watchFile(file, { interval: 100 }, external)
  native.get(file)!.emit('change', stats(20), stats(2))
  for (const subscriber of [slow, fast, sibling]) {
    expect(subscriber.listener).toHaveBeenLastCalledWith(file, stats(20))
    expect(subscriber.raw).toHaveBeenLastCalledWith('change', file, { curr: stats(20), prev: stats(2) })
  }
  const first = closeUpgrader ? fast : slow
  const survivor = closeUpgrader ? slow : fast
  first.close()
  first.close()
  expect(native.get(file)).toBe(current.watcher)
  native.get(file)!.emit('change', stats(40), stats(20))
  expect(first.listener).toHaveBeenCalledOnce()
  expect(survivor.listener).toHaveBeenLastCalledWith(file, stats(40))
  expect(sibling.listener).toHaveBeenLastCalledWith(file, stats(40))
  previous.listener(stats(60), stats(40))
  expect(survivor.listener).toHaveBeenCalledTimes(2)
  survivor.close()
  sibling.close()
  sibling.close()
  expect(native.get(file)).toBe(current.watcher)
  native.get(file)!.emit('change', stats(80), stats(60))
  expect(external).toHaveBeenLastCalledWith(stats(80), stats(60))
  native.get(otherFile)!.emit('change', stats(80), stats(2))
  expect(other.listener).toHaveBeenLastCalledWith(otherFile, stats(80))
  fs.unwatchFile(file, external)
  expect(native.has(file)).toBe(false)
})

it('merges faster and persistent requests without downgrading either existing capability', () => {
  owner(80, false)
  owner(120, true)
  owner(40, false)
  expect(acquisitions.map(item => item.options)).toMatchObject([
    { interval: 80, persistent: false },
    { interval: 80, persistent: true },
    { interval: 40, persistent: true },
  ])
})

it('finishes an accepted raw publication across a synchronous same-container upgrade', () => {
  const slow = owner(120)
  const previous = acquisitions[0]
  let fast: ReturnType<typeof owner> | undefined
  slow.raw.mockImplementationOnce(() => {
    fast = owner(100)
  })
  previous.listener(stats(20), stats(2))
  expect(slow.listener).toHaveBeenLastCalledWith(file, stats(20))
  expect(fast!.listener).not.toHaveBeenCalled()
  const current = acquisitions[1]
  previous.listener(stats(40), stats(20))
  expect(slow.listener).toHaveBeenCalledOnce()
  current.listener(stats(60), stats(40))
  expect(slow.listener).toHaveBeenLastCalledWith(file, stats(60))
  expect(fast!.listener).toHaveBeenLastCalledWith(file, stats(60))
})

it('does not deliver a raw callback to a closed owner or a replacement container', () => {
  const previous = owner(120)
  const oldBinding = acquisitions[0]
  let replacement: ReturnType<typeof owner> | undefined
  previous.raw.mockImplementationOnce(() => {
    previous.close()
    previous.close()
    replacement = owner(100)
  })
  oldBinding.listener(stats(20), stats(2))
  expect(previous.listener).not.toHaveBeenCalled()
  expect(replacement!.listener).not.toHaveBeenCalled()
  previous.close()
  acquisitions[1].listener(stats(40), stats(20))
  expect(replacement!.listener).toHaveBeenLastCalledWith(file, stats(40))
})

it('restores existing polling owners and preserves the original acquisition error', () => {
  const existing = owner(120, false)
  const external = vi.fn()
  fs.watchFile(file, { interval: 120 }, external)
  const original = new Error('upgrade-acquisition-failed')
  vi.mocked(fs.watchFile).mockImplementationOnce(() => {
    throw original
  })
  expect(() => owner(100)).toThrow(original)
  expect(acquisitions.at(-1)?.options).toMatchObject({ interval: 120, persistent: false })
  native.get(file)!.emit('change', stats(20), stats(2))
  expect(existing.listener).toHaveBeenLastCalledWith(file, stats(20))
  expect(external).toHaveBeenCalledOnce()
  const recovered = owner(100)
  native.get(file)!.emit('change', stats(40), stats(20))
  expect(existing.listener).toHaveBeenLastCalledWith(file, stats(40))
  expect(recovered.listener).toHaveBeenLastCalledWith(file, stats(40))
  existing.close()
  recovered.close()
  native.get(file)!.emit('change', stats(60), stats(40))
  expect(external).toHaveBeenCalledTimes(3)
  fs.unwatchFile(file, external)
})

it('retains both acquisition errors without releasing another copy when restoration fails', () => {
  const existing = owner(120)
  const external = vi.fn()
  fs.watchFile(file, { interval: 120 }, external)
  const acquisition = new Error('upgrade-acquisition-failed')
  const restoration = new Error('restore-acquisition-failed')
  vi.mocked(fs.watchFile)
    .mockImplementationOnce(() => { throw acquisition })
    .mockImplementationOnce(() => { throw restoration })
  let actual: unknown
  try {
    owner(100)
  }
  catch (error) { actual = error }
  expect(actual).toBeInstanceOf(AggregateError)
  expect((actual as AggregateError).errors).toEqual([acquisition, restoration])
  existing.close()
  existing.close()
  native.get(file)!.emit('change', stats(20), stats(2))
  expect(external).toHaveBeenCalledOnce()
  fs.unwatchFile(file, external)
})
