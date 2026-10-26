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
  const scheduling = { run: (work: () => unknown) => work() }
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
        return scheduling.run(reconcile)
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
  const notify = (run: () => unknown, { watched = path.dirname(target), filename = path.basename(target), mapRelative = true } = {}) => {
    watchApi.watch(watched, {}, () => watcher.handler.reconcileBackendTrigger(path.dirname(target), mapRelative, { kind: 'native', relativePath: filename }, run))
    return callbacks.at(-1)!('rename', filename)
  }
  return { watcher, all, observer, notify, scheduling }
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

it.each([false, true])('attributes a Windows root-parent rescan to its original native callback (duplicate=%s)', (duplicate) => {
  const target = path.join(root, 'src', 'entry.txt')
  const ctx = fixture(duplicate, first, target)
  try {
    ctx.notify(() => ctx.watcher.emitEvent('unlink', target))
    ctx.notify(() => {
      ctx.watcher.tree.recordObserved(target, replacement)
      ctx.watcher.emitEvent('add', target, replacement)
    }, { watched: root, filename: 'src', mapRelative: false })
    ctx.observer.flush(() => {})
    ctx.watcher.closed = true
    const verify = () => ctx.observer.assert(replacement, replacement, ctx.all)
    if (duplicate) {
      expect(verify).toThrow('the original atomic ADD produces exactly one public change')
    }
    else {
      expect(verify).not.toThrow()
      expect(ctx.observer.snapshot().native).toContainEqual({ id: 2, path: '', event: 'rename', filename: 'src' })
      expect(ctx.observer.snapshot().calls.at(-1).native).toBe(2)
    }
  }
  finally { ctx.observer.close() }
})

it('retains the enqueueing notification when a coalesced reconciliation runs outside that callback context', async () => {
  const ctx = fixture(false)
  try {
    ctx.notify(() => ctx.watcher.emitEvent('unlink', file))
    let queued: (() => unknown) | undefined
    const originalResult = Promise.resolve('original reconciliation result')
    ctx.scheduling.run = (work) => {
      queued = work
      return originalResult
    }
    expect(ctx.notify(() => {
      ctx.watcher.tree.recordObserved(file, replacement)
      ctx.watcher.emitEvent('add', file, replacement)
    })).toBe(originalResult)
    await Promise.resolve()
    queued!()
    ctx.observer.flush(() => {})
    ctx.watcher.closed = true
    expect(() => ctx.observer.assert(replacement, replacement, ctx.all)).not.toThrow()
    expect(ctx.observer.snapshot().calls.at(-1).native).toBe(2)
    expect(ctx.all).toEqual(['change'])
  }
  finally { ctx.observer.close() }
})

it.each(['missing', 'outside-fixture'])('rejects an ADD without an owned original native callback (%s)', (kind) => {
  const ctx = fixture(false)
  try {
    ctx.notify(() => ctx.watcher.emitEvent('unlink', file))
    const add = () => {
      ctx.watcher.tree.recordObserved(file, replacement)
      ctx.watcher.emitEvent('add', file, replacement)
    }
    if (kind === 'missing') {
      ctx.watcher.handler.reconcileBackendTrigger(root, false, { kind: 'native' }, add)
    }
    else { ctx.notify(add, { watched: path.dirname(root) }) }
    ctx.observer.flush(() => {})
    ctx.watcher.closed = true
    expect(() => ctx.observer.assert(replacement, replacement, ctx.all)).toThrow('the replacement ADD must originate from a real native notification')
    expect(ctx.all).toEqual(['change'])
  }
  finally { ctx.observer.close() }
})
