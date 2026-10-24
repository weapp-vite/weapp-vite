import { EventEmitter } from 'node:events'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { verifyRemoveCooldown } from './removeCooldown.mjs'

const io = vi.hoisted(() => ({
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
  const ready = vi.fn().mockResolvedValue(undefined)
  const instrumentation = { settleDirectoryRegistration: vi.fn(() => barrier.promise) }
  const run = () => verifyRemoveCooldown({
    entryType: 'atomic',
    chokidar: {},
    root,
    watched: path.join(root, 'src'),
    timeoutMs: 1000,
    open: () => owner,
    ready,
    instrumentation,
    evidence: [],
  }).catch((error: unknown) => error)
  return { barrier, owner, ready, instrumentation, run }
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
