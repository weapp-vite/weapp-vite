import { EventEmitter } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { observeFileListeners, waitForObservedEventPhase } from './eventPhase.mjs'
import { observeWatcher } from './support.mjs'

const root = path.resolve('event-phase-fixture')
const file = path.join(root, 'entry.txt')

interface WatcherOptions {
  cwd?: string
  atomic?: boolean
  awaitWriteFinish?: { stabilityThreshold: number }
}

type Listener = (...args: unknown[]) => unknown

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((resolve_, reject_) => {
    resolve = resolve_
    reject = reject_
  })
  return { promise, resolve, reject }
}

function fixture(options: WatcherOptions = {}) {
  const listeners = new Map<string, Listener>()
  const turns: (() => void)[] = []
  let clock = 0
  const closer = () => {}
  const watcher = {
    closed: false,
    options: { atomic: false, ...options },
    _throttled: new Map<string, Map<string, { clear: ReturnType<typeof vi.fn> }>>(),
    _nodeFsHandler: {
      _watchWithNodeFs(file: string, listener: Listener, _directory?: boolean) {
        listeners.set(path.resolve(file), listener)
        return closer
      },
    },
  }
  const observer = observeFileListeners(watcher, {
    turn: () => new Promise<void>(resolve => turns.push(resolve)),
    now: () => clock,
  })
  function register(target: string, listener: Listener) {
    expect(watcher._nodeFsHandler._watchWithNodeFs(target, listener, false)).toBe(closer)
    return (...args: unknown[]) => listeners.get(path.resolve(target))!.apply(watcher, args)
  }
  function throttle(action: string, key: string, duration: number) {
    const entries = watcher._throttled.get(action) || new Map()
    watcher._throttled.set(action, entries)
    const entry = { clear: vi.fn(() => {
      throw new Error('observer must not clear an original timer')
    }) }
    entries.set(key, entry)
    setTimeout(() => entries.delete(key), duration)
    return entry
  }
  async function step(elapsed = 0) {
    clock += elapsed
    await vi.advanceTimersByTimeAsync(elapsed)
    expect(turns.length).toBeGreaterThan(0)
    turns.shift()!()
    await Promise.resolve()
    await Promise.resolve()
  }
  return { watcher, observer, register, throttle, step }
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

it('waits for an old listener across an empty watch map and its later natural change cooldown', async () => {
  const ctx = fixture()
  const gate = deferred()
  let returned: Promise<unknown> | undefined
  const invoke = ctx.register(file, () => {
    returned = gate.promise.then(() => ctx.throttle('change', file, 50))
    return returned
  })
  const watch = ctx.throttle('watch', file, 5)
  expect(invoke('original argument')).toBe(returned)
  let drained = false
  const evidence: unknown[] = []
  const done = waitForObservedEventPhase({ eventPhases: ctx.observer }, file, evidence, 200).then(() => {
    drained = true
  })
  await ctx.step(5)
  expect(ctx.observer.snapshot(file)).toMatchObject({ pending: 1, entries: [] })
  expect(drained).toBe(false)
  gate.resolve()
  await returned
  await ctx.step(49)
  expect(drained).toBe(false)
  await ctx.step(1)
  expect(drained).toBe(false)
  await ctx.step()
  await done
  expect(watch.clear).not.toHaveBeenCalled()
  expect(evidence).toEqual([expect.objectContaining({
    checkpoint: 'observed-event-phase-drained',
    listenerCalls: 1,
    completedListeners: 1,
    naturalThrottleEntries: { watch: 1, change: 1 },
  })])
})

it('requires an unchanged listener epoch across a full observation turn', async () => {
  const ctx = fixture()
  const invoke = ctx.register(file, () => 'same return value')
  let drained = false
  const done = ctx.observer.drain(file, 100).then(() => {
    drained = true
  })
  expect(invoke()).toBe('same return value')
  await ctx.step()
  expect(drained).toBe(false)
  await ctx.step()
  expect(await done).toBeUndefined()
  expect(drained).toBe(true)
})

it('uses cwd only for emitted change keys and ignores other exact paths and owners', async () => {
  const cwd = path.join(root, 'project')
  const exact = path.join(cwd, 'entry.txt')
  const unrelated = path.join(cwd, 'other', 'entry.txt')
  const ctx = fixture({ cwd })
  ctx.register(exact, () => {})
  const pendingOther = deferred()
  ctx.register(unrelated, () => pendingOther.promise)()
  const otherOwner = fixture({ cwd })
  otherOwner.register(exact, () => pendingOther.promise)()
  const watch = ctx.throttle('watch', exact, 5)
  const change = ctx.throttle('change', 'entry.txt', 50)
  ctx.throttle('change', path.join('other', 'entry.txt'), 500)
  let drained = false
  const done = ctx.observer.drain(exact, 100).then(() => {
    drained = true
  })
  await ctx.step(5)
  expect(drained).toBe(false)
  await ctx.step(45)
  expect(drained).toBe(false)
  await ctx.step()
  await done
  expect(ctx.observer.snapshot(unrelated).pending).toBe(1)
  expect(otherOwner.observer.snapshot(exact).pending).toBe(1)
  expect(watch.clear).not.toHaveBeenCalled()
  expect(change.clear).not.toHaveBeenCalled()
  pendingOther.resolve()
})

it('preserves listener this, arguments, return Promise, and the original rejection object', async () => {
  const ctx = fixture()
  const originalError = new Error('original listener rejection')
  const gate = deferred()
  let seenArgs: unknown[] | undefined
  const invoke = ctx.register(file, function (this: typeof ctx.watcher, ...args) {
    expect(this).toBe(ctx.watcher)
    seenArgs = args
    return gate.promise
  })
  const stats = { size: 23 }
  const returned = invoke(file, stats)
  expect(returned).toBe(gate.promise)
  expect(seenArgs).toEqual([file, stats])
  const rejected = expect(returned).rejects.toBe(originalError)
  gate.reject(originalError)
  await rejected
  expect(ctx.observer.failures).toEqual([originalError])
  await expect(ctx.observer.drain(file, 100)).rejects.toBe(originalError)
})

it('preserves synchronous throws and records them separately from public error events', async () => {
  const ctx = fixture()
  const error = new Error('original synchronous failure')
  const invoke = ctx.register(file, () => {
    throw error
  })
  expect(invoke).toThrow(error)
  expect(ctx.observer.failures[0]).toBe(error)
  expect(ctx.observer.snapshot(file).pending).toBe(0)
  await expect(ctx.observer.drain(file, 100)).rejects.toBe(error)
})

it('fails on timeout without clearing a timer or abandoning its still-observed listener', async () => {
  const ctx = fixture()
  const gate = deferred()
  ctx.register(file, () => gate.promise)()
  const original = ctx.throttle('watch', file, 500)
  const done = expect(ctx.observer.drain(file, 10)).rejects.toThrow('Deadline exceeded: observed event phase entry.txt')
  await ctx.step(10)
  await done
  expect(original.clear).not.toHaveBeenCalled()
  expect(ctx.observer.snapshot(file)).toMatchObject({ pending: 1, entries: [{ action: 'watch', entry: original }] })
  gate.resolve()
  await gate.promise
  await Promise.resolve()
  expect(ctx.observer.snapshot(file).pending).toBe(0)
})

it('rejects a closed owner before or during the observation turn', async () => {
  const ctx = fixture()
  ctx.register(file, () => {})
  const done = expect(ctx.observer.drain(file, 100)).rejects.toThrow('closed owner')
  ctx.watcher.closed = true
  await ctx.step()
  await done
  await expect(ctx.observer.drain(file, 100)).rejects.toThrow('closed owner')
})

it('waits for a delayed rejection after public close and retains it for final failure reporting', async () => {
  const ctx = fixture()
  const gate = deferred()
  ctx.register(file, () => gate.promise)()
  ctx.watcher.closed = true
  let settled = false
  const done = ctx.observer.settle(100).then(() => {
    settled = true
  })
  await ctx.step()
  expect(settled).toBe(false)
  const error = new Error('original rejection after public close')
  gate.reject(error)
  await Promise.resolve()
  await ctx.step()
  expect(settled).toBe(false)
  await ctx.step()
  await done
  expect(ctx.observer.pending).toBe(0)
  expect(ctx.observer.failures[0]).toBe(error)
})

it('fails closed when a registered listener remains pending after close', async () => {
  const ctx = fixture()
  const gate = deferred()
  ctx.register(file, () => gate.promise)()
  ctx.watcher.closed = true
  const done = expect(ctx.observer.settle(10)).rejects.toThrow('Deadline exceeded: closed owner listener settlement')
  await ctx.step(10)
  await done
  expect(ctx.observer.pending).toBe(1)
  gate.resolve()
})

it.each([{ atomic: true }, { awaitWriteFinish: { stabilityThreshold: 200 } }])('fails closed for unobserved deferred emit work: %j', async (options) => {
  const ctx = fixture(options)
  ctx.register(file, () => {})
  await expect(ctx.observer.drain(file, 100)).rejects.toThrow(/does not cover/)
})

it('installs observation before add and keeps a stale size event from satisfying the target waiter', async () => {
  class FakeWatcher extends EventEmitter {
    options: WatcherOptions
    closed = false
    _throttled = new Map()
    _nodeFsHandler = { _watchWithNodeFs: vi.fn((_file: string, _listener: Listener, _directory?: boolean) => () => {}) }
    originalRegistration = this._nodeFsHandler._watchWithNodeFs

    constructor(options: WatcherOptions) {
      super()
      this.options = options
    }

    add(paths: string) {
      expect(this._nodeFsHandler._watchWithNodeFs).not.toBe(this.originalRegistration)
      this._nodeFsHandler._watchWithNodeFs(paths, () => {}, false)
      this.emit('ready')
      return this
    }
  }
  const owner = observeWatcher({ FSWatcher: FakeWatcher }, root, file, { cwd: root })
  await owner.ready
  const received = owner.event('change', file, 100, stats => stats?.size === 12)
  let complete = false
  void received.then(() => {
    complete = true
  })
  owner.watcher.emit('all', 'change', 'entry.txt', { size: 0 })
  await Promise.resolve()
  expect(complete).toBe(false)
  owner.watcher.emit('all', 'change', 'entry.txt', { size: 12 })
  expect(await received).toEqual({ event: 'change', path: 'entry.txt' })
  expect(owner.errors).toEqual([])
  expect(owner.events.map(event => event.path)).toEqual(['entry.txt', 'entry.txt'])
  expect(process.cwd()).not.toBe(root)
})
