import { EventEmitter } from 'node:events'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { verifyRemoveCooldown } from './removeCooldown.mjs'

const io = vi.hoisted(() => ({
  rename: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  ...io,
}))

function fixture() {
  const root = path.resolve('atomic-registration-fixture')
  const barrier = Promise.withResolvers<void>()
  void barrier.promise.catch(() => {})
  const watcher = Object.assign(new EventEmitter(), {
    _pendingUnlinks: new Map(),
    _throttled: new Map(),
  })
  const owner = { watcher, events: [], errors: [], event: vi.fn() }
  const open = vi.fn(() => owner)
  const ready = vi.fn().mockResolvedValue(undefined)
  const instrumentation = { settleDirectoryRegistration: vi.fn(() => barrier.promise) }
  const run = () => verifyRemoveCooldown({
    entryType: 'atomic',
    chokidar: {},
    root,
    watched: path.join(root, 'src'),
    timeoutMs: 1000,
    open,
    ready,
    instrumentation,
    evidence: [],
  }).catch((error: unknown) => error)
  return { root, barrier, owner, open, ready, instrumentation, run }
}

beforeEach(() => {
  vi.resetAllMocks()
  io.writeFile.mockResolvedValue(undefined)
})

it('awaits exact directory registration after public ready and before removing the atomic source', async () => {
  const ctx = fixture()
  const original = new Error('stop after the first owned removal')
  io.rm.mockRejectedValue(original)
  const result = ctx.run()
  try {
    await new Promise(resolve => setImmediate(resolve))
    expect(ctx.ready).toHaveBeenCalledExactlyOnceWith(ctx.owner)
    expect(ctx.instrumentation.settleDirectoryRegistration).toHaveBeenCalledExactlyOnceWith(1000)
    expect(io.rm, 'public ready cannot stand in for the native directory subscription barrier').not.toHaveBeenCalled()
  }
  finally { ctx.barrier.resolve() }
  expect(await result).toBe(original)
  expect(io.rm).toHaveBeenCalledOnce()
})

it('preserves a failed native registration barrier and leaves the source intact', async () => {
  const ctx = fixture()
  const original = new Error('exact native registration failed')
  const unexpected = new Error('the source was removed before registration')
  io.rm.mockRejectedValue(unexpected)
  const result = ctx.run()
  await new Promise(resolve => setImmediate(resolve))
  ctx.barrier.reject(original)
  expect(await result).toBe(original)
  expect(io.rm).not.toHaveBeenCalled()
  expect(ctx.owner.events).toEqual([])
})

it('publishes a fully written replacement from outside the watch root after holding the exact unlink', async () => {
  const ctx = fixture()
  const file = path.join(ctx.root, 'src/cooldown-atomic.txt')
  const replacement = path.join(ctx.root, 'cooldown-atomic-replacement.txt')
  const original = new Error('stop at the replacement rename')
  io.rm.mockImplementation(async (removed) => {
    const entry = { timeoutObject: setTimeout(() => {}, 100), clear: vi.fn() }
    ctx.owner.watcher._throttled.set('remove', new Map([[removed, entry]]))
    ctx.owner.watcher._pendingUnlinks.set(removed, ['unlink', removed])
    setTimeout(() => {}, 100)
  })
  io.rename.mockRejectedValue(original)
  const result = ctx.run()
  ctx.barrier.resolve()
  expect(await result).toBe(original)
  expect(io.writeFile).toHaveBeenCalledTimes(2)
  expect(io.writeFile).toHaveBeenNthCalledWith(1, file, 'first atomic generation')
  expect(io.writeFile).toHaveBeenNthCalledWith(2, replacement, 'replacement atomic generation remains a single public change')
  expect(ctx.open).toHaveBeenCalledExactlyOnceWith({}, path.join(ctx.root, 'src'), { atomic: 100 })
  expect(io.writeFile.mock.invocationCallOrder[1]).toBeLessThan(ctx.open.mock.invocationCallOrder[0]!)
  expect(io.rename).toHaveBeenCalledExactlyOnceWith(replacement, file)
  expect(io.rm.mock.invocationCallOrder[0]).toBeLessThan(io.rename.mock.invocationCallOrder[0]!)
})
