import type fs from 'node:fs'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createAtomicDeliveryObserver } from './atomicDelivery.mjs'

type Listener = (...args: unknown[]) => unknown
const root = path.resolve('atomic-causal-fixture')
const file = path.join(root, 'entry.txt')
const first = { dev: 1, ino: 10, size: 5, mtimeMs: 100, ctimeMs: 100, atimeMs: 100 }
const replacement = { ...first, ino: 20, size: 23, mtimeMs: 200, ctimeMs: 200 }

function fixture() {
  const callbacks: Listener[] = []
  const originalListeners: Listener[] = []
  const all: string[] = []
  const receiver = {}
  const result = Promise.resolve('original emit result')
  const settings = { duplicate: false }
  const closer = () => {}
  const watchApi = { watch: vi.fn((_watched: string, ...args: unknown[]) => {
    callbacks.push(args.at(-1) as Listener)
    return receiver
  }) }
  const emitter = new EventEmitter()
  const watcher = Object.assign(emitter, {
    options: { atomic: 100 },
    closed: false,
    _pendingUnlinks: new Map(),
    _nodeFsHandler: {
      _watchWithNodeFs(_file: string, listener: Listener, _directory: boolean, _stats: unknown) {
        originalListeners.push(listener)
        return closer
      },
    },
    _emit(event: string, emitted: string, _stats?: unknown) {
      if (event === 'unlink') {
        this._pendingUnlinks.set(emitted, ['unlink', emitted])
        return result
      }
      if (event === 'add' && this._pendingUnlinks.has(emitted)) {
        this._pendingUnlinks.delete(emitted)
        event = 'change'
      }
      emitter.emit('all', event, emitted)
      if (settings.duplicate) {
        emitter.emit('all', event, emitted)
      }
      return result
    },
  })
  watcher.on('all', event => all.push(event))
  const originalEmit = watcher._emit
  const originalRegistration = watcher._nodeFsHandler._watchWithNodeFs
  const originalWatch = watchApi.watch
  const synchronize = vi.fn()
  const observer = createAtomicDeliveryObserver({ root, file }, { watchApi: watchApi as unknown as typeof fs, synchronize })
  observer.attach({ watcher })
  const register = (stats = replacement, listener: Listener = () => watcher._emit('change', file, stats)) => {
    expect(watcher._nodeFsHandler._watchWithNodeFs(file, listener, false, stats)).toBe(closer)
    return originalListeners.at(-1)!
  }
  const invokeFile = (...args: unknown[]) => originalListeners.at(-1)!.apply(receiver, args)
  const notify = (run: Listener) => {
    expect(watchApi.watch(path.dirname(file), {}, run)).toBe(receiver)
    const callback = callbacks.at(-1)!
    return (...args: unknown[]) => callback.apply(receiver, args.length ? args : ['rename', path.basename(file)])
  }
  const initialListener = register(first)
  observer.start()
  const atomic = (listener?: Listener, afterAdd?: () => void) => {
    expect(notify(() => watcher._emit('unlink', file))()).toBe(result)
    register(replacement, listener)
    return notify(() => {
      const returned = watcher._emit('add', file, replacement)
      afterAdd?.()
      return returned
    })()
  }
  const finish = () => {
    if (!observer.snapshot().flushes.length) {
      observer.flush(() => {})
    }
    watcher.closed = true
    observer.assert(replacement, replacement, all)
  }
  return { observer, watcher, notify, invokeFile, initialListener, atomic, finish, all, result, settings, receiver, synchronize, watchApi, originalEmit, originalRegistration, originalWatch }
}

it('keeps both public changes and proves one atomic conversion plus an independent native listener across await', async () => {
  const ctx = fixture()
  try {
    const gate = Promise.withResolvers<void>()
    let listenerResult: Promise<string> | undefined
    const listener = vi.fn(function (this: unknown, ...args: unknown[]) {
      expect(this).toBe(ctx.receiver)
      expect(args).toEqual([file, replacement])
      listenerResult = gate.promise.then(() => {
        expect(ctx.watcher._emit('change', file, replacement)).toBe(ctx.result)
        return ctx.result
      })
      return listenerResult
    })
    expect(ctx.atomic(listener)).toBe(ctx.result)
    const notification = vi.fn(function (this: unknown, ...args: unknown[]) {
      expect(this).toBe(ctx.receiver)
      expect(args).toEqual(['change', path.basename(file)])
      return ctx.invokeFile(file, replacement)
    })
    expect(ctx.notify(notification)('change', path.basename(file))).toBe(listenerResult)
    gate.resolve()
    expect(await listenerResult).toBe('original emit result')
    expect(listener).toHaveBeenCalledOnce()
    expect(notification).toHaveBeenCalledOnce()
    ctx.finish()
    expect(ctx.all).toEqual(['change', 'change'])
    expect(ctx.observer.snapshot().events).toHaveLength(ctx.all.length)
  }
  finally { ctx.observer.close() }
})

it.each([
  ['unknown', 'no public event may lack'],
  ['duplicate-emit', 'one original _emit may publish at most one change'],
  ['same-notification', 'one real notification/listener cannot justify duplicate'],
  ['atomic-notification', 'one real notification/listener cannot justify duplicate'],
  ['old-generation', 'old file listeners cannot account'],
  ['wrong-state', 'independent change observes the exact replacement generation'],
  ['wrong-filename', 'the real notification must address the exact target'],
  ['flush', 'the original held atomic flush emits nothing'],
] as const)('rejects %s without filtering original all-events', async (kind, message) => {
  const ctx = fixture()
  try {
    const listener = kind === 'wrong-state' ? () => ctx.watcher._emit('change', file, { ...replacement, size: 99 }) : undefined
    ctx.atomic(listener, kind === 'atomic-notification' ? () => ctx.invokeFile() : undefined)
    if (kind === 'unknown') {
      ctx.watcher.emit('all', 'change', file)
    }
    if (kind === 'duplicate-emit') {
      ctx.settings.duplicate = true
      ctx.notify(() => ctx.invokeFile())()
    }
    if (kind === 'same-notification') {
      ctx.notify(() => {
        ctx.invokeFile()
        ctx.invokeFile()
      })()
    }
    if (kind === 'old-generation') {
      ctx.notify(() => ctx.initialListener.apply(ctx.receiver, []))()
    }
    if (kind === 'wrong-state') {
      ctx.notify(() => ctx.invokeFile())()
    }
    if (kind === 'wrong-filename') {
      ctx.notify(() => ctx.invokeFile())('rename', 'another.txt')
    }
    if (kind === 'flush') {
      await ctx.observer.flush(async () => {
        await Promise.resolve()
        ctx.watcher._emit('change', file, replacement)
      })
    }
    expect(() => ctx.finish()).toThrow(message)
    expect(ctx.observer.snapshot().events).toHaveLength(ctx.all.length)
  }
  finally { ctx.observer.close() }
})

it('preserves original synchronous errors and rejected promise identities and restores wrappers idempotently', async () => {
  const ctx = fixture()
  try {
    const original = new Error('original callback error')
    const rejected = Promise.reject(original)
    void rejected.catch(() => {})
    expect(() => ctx.notify(() => {
      throw original
    })()).toThrow(original)
    expect(ctx.notify(() => rejected)()).toBe(rejected)
    await expect(rejected).rejects.toBe(original)
    ctx.observer.close()
    ctx.observer.close()
    expect(ctx.watcher._emit).toBe(ctx.originalEmit)
    expect(ctx.watcher._nodeFsHandler._watchWithNodeFs).toBe(ctx.originalRegistration)
    expect(ctx.watchApi.watch).toBe(ctx.originalWatch)
  }
  finally { ctx.observer.close() }
})
