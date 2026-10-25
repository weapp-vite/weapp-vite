import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { verifyFileBranches } from './fileBranches.mjs'
import { observeWatcher } from './support.mjs'

const io = vi.hoisted(() => ({
  readFile: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  ...io,
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolve_) => {
    resolve = resolve_
  })
  return { promise, resolve }
}

function fixture(staleIdentity: 'ino' | 'dev' = 'ino') {
  const root = path.resolve('native-inode-fixture')
  const watched = path.join(root, 'src')
  const file = path.join(watched, 'inode-file.txt')
  const replacement = path.join(root, 'inode-replacement.tmp')
  const initialWork = deferred()
  const originalClosed = deferred()
  const originalStats = { dev: 1, ino: 101, size: Buffer.byteLength('original inode') }
  const replacementStats = { dev: 1, ino: 202, size: Buffer.byteLength('replacement inode with a distinct size') }
  let currentStats = originalStats
  let content = ''
  let prepared = false
  let fileListener: (() => unknown) | undefined
  let owner: ReturnType<typeof observeWatcher> | undefined
  const waiters: { settled: boolean, promise: Promise<unknown>, predicate: ReturnType<typeof vi.fn> }[] = []
  const originalHandle = { path: 'src', closed: false, closePromise: originalClosed.promise }
  const handles = [originalHandle]
  const evidence: { checkpoint: string }[] = []

  function throttle(action: string, duration: number) {
    const entries = owner!.watcher._throttled.get(action) || new Map()
    owner!.watcher._throttled.set(action, entries)
    entries.set(file, { count: 0 })
    setTimeout(() => entries.delete(file), duration)
  }

  class FakeWatcher extends EventEmitter {
    options: { atomic: boolean }
    closed = false
    _throttled = new Map<string, Map<string, { count: number }>>()
    _nodeFsHandler = {
      _watchWithNodeFs(_file: string, listener: () => unknown, _directory?: boolean) {
        fileListener = listener
        return () => {}
      },
    }

    constructor(options: { atomic: boolean }) {
      super()
      this.options = options
    }

    add() {
      this._nodeFsHandler._watchWithNodeFs(file, () => initialWork.promise.then(() => {
        throttle('change', 50)
        this.emit('all', 'change', file, originalStats)
      }), false)
      this.emit('ready')
      return this
    }
  }

  const open = vi.fn((chokidar, paths, options) => {
    expect(prepared, 'replacement staging must finish before any subscription').toBe(true)
    owner = observeWatcher(chokidar, root, paths, options)
    const event = owner.event.bind(owner)
    owner.event = vi.fn((...args: Parameters<typeof event>) => {
      const predicate = vi.fn(args[3] || (() => true))
      const result = event(args[0], args[1], args[2], predicate)
      const waiter = { settled: false, promise: result, predicate }
      waiters.push(waiter)
      void result.then(() => {
        waiter.settled = true
      }, () => {})
      return result
    })
    throttle('watch', 5)
    void fileListener!()
    return owner
  })

  io.stat.mockImplementation(async (target: string) => target === replacement ? replacementStats : currentStats)
  io.readFile.mockImplementation(async () => content)
  io.writeFile.mockImplementation(async (target: string, value: string, options?: { flag: string }) => {
    if (target === replacement) {
      expect(owner, 'staging cannot inject another watched-directory mutation').toBeUndefined()
      prepared = true
      return
    }
    expect(target).toBe(file)
    if (owner) {
      expect(options).toEqual({ flag: 'r+' })
      expect(Buffer.byteLength(value)).toBeGreaterThan(currentStats.size)
      owner.watcher.emit('all', 'change', file, currentStats)
      expect(waiters[1].predicate).toHaveLastReturnedWith(false)
      expect(waiters[1].settled, 'a stale size cannot satisfy the second write').toBe(false)
      currentStats = { ...currentStats, size: Buffer.byteLength(value) }
      owner.watcher.emit('all', 'change', file, currentStats)
    }
    content = value
  })
  io.rename.mockImplementation(async (from: string, to: string) => {
    expect([from, to]).toEqual([replacement, file])
    expect(waiters).toHaveLength(1)
    expect(owner!.eventPhases.snapshot(file)).toMatchObject({ pending: 0, entries: [] })
    const stale = { ...replacementStats, [staleIdentity]: originalStats[staleIdentity] + (staleIdentity === 'dev' ? 1 : 0) }
    owner!.watcher.emit('all', 'change', file, stale)
    expect(waiters[0].predicate).toHaveLastReturnedWith(false)
    expect(waiters[0].settled, 'size alone cannot identify the replacement inode').toBe(false)
    currentStats = replacementStats
    // 在 rename 的 Promise 返回前交付事件，必须由已经登记的真实 waiter 捕获。
    throttle('change', 50)
    owner!.watcher.emit('all', 'change', file, currentStats)
    await waiters[0].promise
    expect(waiters[0].settled).toBe(true)
  })

  const run = () => {
    const result = verifyFileBranches({
      branch: 'inode',
      chokidar: { FSWatcher: FakeWatcher },
      root,
      watched,
      timeoutMs: 1000,
      open,
      ready: (observed: ReturnType<typeof observeWatcher>) => observed.ready,
      instrumentation: { actualPlatform: 'darwin', handles },
      evidence,
    })
    void result.catch(() => {})
    return result
  }
  return {
    run,
    open,
    file,
    initialWork,
    waiters,
    evidence,
    get owner() { return owner! },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'clearImmediate'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

it('prepares outside the watched directory and drains an old listener plus its natural cooldown before rename', async () => {
  const ctx = fixture()
  const run = ctx.run()
  await vi.advanceTimersByTimeAsync(0)
  expect(ctx.open).toHaveBeenCalledOnce()
  expect(ctx.owner.eventPhases.snapshot(ctx.file).pending).toBe(1)
  expect(io.rename).not.toHaveBeenCalled()
  expect(ctx.waiters).toEqual([])
  ctx.initialWork.resolve()
  await vi.advanceTimersByTimeAsync(49)
  expect(io.rename).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(55)
  await run
  expect(ctx.waiters.map(waiter => waiter.settled)).toEqual([true, true])
  expect(ctx.evidence.map(item => item.checkpoint)).toEqual([
    'observed-event-phase-drained',
    'real-inode-replacement-with-directory-coverage',
    'observed-event-phase-drained',
    'second-change-after-real-inode-rebind',
  ])
})

it.each(['ino', 'dev'] as const)('requires replacement %s identity and captures change before rename resolves', async (identity) => {
  const ctx = fixture(identity)
  const run = ctx.run()
  await vi.advanceTimersByTimeAsync(0)
  ctx.initialWork.resolve()
  await vi.advanceTimersByTimeAsync(110)
  await run
  expect(io.rename).toHaveBeenCalledOnce()
  expect(io.writeFile).toHaveBeenCalledTimes(3)
  expect(ctx.owner.errors).toEqual([])
  expect(ctx.owner.eventPhases.failures).toEqual([])
})
