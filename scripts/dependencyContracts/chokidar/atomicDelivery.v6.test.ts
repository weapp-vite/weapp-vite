import type fs from 'node:fs'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createAtomicDeliveryObserver } from './atomicDelivery.mjs'

const root = path.resolve('v6-atomic-causal-fixture')
const file = path.join(root, 'entry.txt')
const first = { dev: 1, ino: 10, size: 5, mtimeMs: 100, ctimeMs: 100, atimeMs: 100 }
const replacement = { ...first, ino: 20, size: 23, mtimeMs: 200, ctimeMs: 200 }

function fixture(duplicate: boolean, initial = first, target = file) {
  const callbacks: Array<(...args: unknown[]) => unknown> = []
  const watchApi = { watch: vi.fn((_watched: string, ...args: unknown[]) => {
    callbacks.push(args.at(-1) as (...args: unknown[]) => unknown)
    return {}
  }) }
  const pending = new Map()
  const watcher = Object.assign(new EventEmitter(), {
    closed: false,
    options: { atomic: 100 },
    events: { pendingUnlinks: pending },
    tree: { recordObserved: vi.fn() },
    handler: {
      reconcileBackendTrigger(_scope: string, _relative: boolean, _trigger: unknown, reconcile: () => unknown) {
        return reconcile()
      },
    },
    emitEvent(event: string, emitted: string, _stats?: unknown) {
      const key = emitted.replaceAll('\\', '/')
      if (event === 'unlink') {
        pending.set(key, { event: [event, emitted], timer: {} })
        return
      }
      if (event === 'add' && pending.has(key)) {
        pending.delete(key)
        event = 'change'
      }
      this.emit('all', event, emitted)
      if (duplicate && event === 'change') {
        this.emit('all', event, emitted)
      }
    },
  })
  const all: string[] = []
  watcher.on('all', event => all.push(event))
  const observer = createAtomicDeliveryObserver({ root, file: target }, { watchApi: watchApi as unknown as typeof fs, synchronize() {} })
  observer.attach({ watcher })
  const bigintStats = Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, BigInt(Math.trunc(value))]))
  for (const field of ['mtime', 'ctime', 'atime'] as const) {
    bigintStats[`${field}Ns`] = BigInt(Math.round(initial[`${field}Ms`] * 1e6))
  }
  watcher.tree.recordObserved(target, bigintStats)
  observer.start()
  const notify = (run: () => unknown) => {
    watchApi.watch(path.dirname(target), {}, () => watcher.handler.reconcileBackendTrigger(root, true, {}, run))
    return callbacks.at(-1)!('rename', path.basename(target))
  }
  return { watcher, all, observer, notify }
}

it.each([false, true])('attributes v6 atomic conversion through directory reconciliation (duplicate=%s)', (duplicate) => {
  const ctx = fixture(duplicate)
  try {
    ctx.notify(() => ctx.watcher.emitEvent('unlink', file))
    ctx.notify(() => {
      ctx.watcher.tree.recordObserved(file, replacement)
      ctx.watcher.emitEvent('add', file, replacement)
    })
    ctx.observer.flush(() => {})
    ctx.watcher.closed = true
    const verify = () => ctx.observer.assert(replacement, replacement, ctx.all)
    if (duplicate) {
      expect(verify).toThrow('the original atomic ADD produces exactly one public change')
    }
    else { expect(verify).not.toThrow() }
  }
  finally { ctx.observer.close() }
})

it('compares BigIntStats nanoseconds with the same fractional number Stats generation', () => {
  const initial = { ...first, mtimeMs: 100.125, ctimeMs: 100.125, atimeMs: 100.125 }
  const ctx = fixture(false, initial)
  try {
    ctx.notify(() => ctx.watcher.emitEvent('change', file, initial))
    ctx.notify(() => ctx.watcher.emitEvent('unlink', file))
    ctx.notify(() => {
      ctx.watcher.tree.recordObserved(file, replacement)
      ctx.watcher.emitEvent('add', file, replacement)
    })
    ctx.observer.flush(() => {})
    ctx.watcher.closed = true
    expect(() => ctx.observer.assert(replacement, replacement, ctx.all)).not.toThrow()
    expect(ctx.all).toEqual(['change', 'change'])
  }
  finally { ctx.observer.close() }
})

it('observes the exact v6 atomic entry when the native path and logical key have different separators', () => {
  const target = path.join(root, 'native\\directory/entry.txt')
  const ctx = fixture(false, first, target)
  try {
    ctx.notify(() => ctx.watcher.emitEvent('unlink', target))
    ctx.notify(() => {
      ctx.watcher.tree.recordObserved(target, replacement)
      ctx.watcher.emitEvent('add', target, replacement)
    })
    ctx.observer.flush(() => {})
    ctx.watcher.closed = true
    expect(() => ctx.observer.assert(replacement, replacement, ctx.all)).not.toThrow()
    expect(ctx.all).toEqual(['change'])
  }
  finally { ctx.observer.close() }
})
