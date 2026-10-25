import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { observeFileListeners } from './eventPhase.mjs'

const root = path.resolve('v6-event-phase-fixture')
const file = path.join(root, 'entry.txt')

it('observes the v6 directory reconciliation Promise without requiring a file handle', async () => {
  const gate = Promise.withResolvers<void>()
  const original = new Error('the original reconciliation failure')
  const receiver = {}
  const watcher = {
    closed: false,
    options: { atomic: false },
    tree: { observed: new Map([[file, {}]]) },
    events: { throttled: new Map() },
    handler: {
      handleFile: vi.fn((_file: string) => 'original file result'),
      reconcileBackendTrigger(_scope: string, _relative: boolean, _trigger: unknown, reconcile: (...args: unknown[]) => unknown) {
        return reconcile.call(receiver, file, 'original argument')
      },
    },
  }
  const observer = observeFileListeners(watcher)
  expect(watcher.handler.handleFile(file)).toBe('original file result')
  const returned = watcher.handler.reconcileBackendTrigger(root, true, {}, function (this: unknown, ...args: unknown[]) {
    expect(this).toBe(receiver)
    expect(args).toEqual([file, 'original argument'])
    return gate.promise
  })
  expect(returned).toBe(gate.promise)
  expect(observer.snapshot(file).pending).toBe(1)
  watcher.closed = true
  let settled = false
  const settling = observer.settle(1000).then(() => {
    settled = true
  })
  await new Promise(resolve => setImmediate(resolve))
  expect(settled).toBe(false)
  gate.reject(original)
  await expect(returned).rejects.toBe(original)
  await settling
  expect(observer.pending).toBe(0)
  expect(observer.failures).toEqual([original])
})

it('drains a recursively scanned v6 file through its tree fact', async () => {
  const watcher = {
    closed: false,
    options: { atomic: false },
    tree: { observed: new Map([[file, {}]]) },
    events: { throttled: new Map() },
    handler: { handleFile() {}, reconcileBackendTrigger() {} },
  }
  const observer = observeFileListeners(watcher)
  await expect(observer.drain(file, 1000)).resolves.toMatchObject({ turns: 1 })
})
