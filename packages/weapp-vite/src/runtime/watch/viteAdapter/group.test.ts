import type { ChokidarOptions } from 'chokidar'
import type { PhysicalViteWatchPlan } from './physical'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPhysicalViteWatcherGroup } from './group'

const mocks = vi.hoisted(() => ({ watch: vi.fn(), plan: vi.fn(), current: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('./physical', () => ({ planPhysicalViteWatchTargets: mocks.plan, isPhysicalViteWatchPlanCurrent: mocks.current }))

class Watcher extends EventEmitter {
  options = { usePolling: false }
  unwatch = vi.fn()
  getWatched = vi.fn(() => ({ '/anchor': ['project'] }))
  close = vi.fn(async () => {})
}

function plan(root = '/anchor'): PhysicalViteWatchPlan {
  return { root, targets: ['/anchor/project'], options: {}, identity: { dev: 1, ino: 1 }, reachable: () => true }
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }
  throw new Error('Mock physical owner did not reach the expected phase')
}

function fixture() {
  const watchers: Watcher[] = []
  const registrations: Promise<'ready' | 'closed'>[] = []
  const event = vi.fn()
  const raw = vi.fn()
  const accepts = vi.fn(() => true)
  mocks.watch.mockImplementation(() => {
    const watcher = new Watcher()
    watchers.push(watcher)
    return watcher
  })
  const owner = createPhysicalViteWatcherGroup(['/anchor/project'], {}, {
    accepts,
    event,
    raw,
    options: vi.fn(),
    pending(registration) {
      registrations.push(registration)
      void registration.catch(() => {})
    },
  })
  return { owner, watchers, registrations, event, raw, accepts }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.plan.mockResolvedValue([plan()])
  mocks.current.mockResolvedValue(true)
})
afterEach(() => vi.useRealTimers())

it('registers planning synchronously and does not publish readiness before anchor validation', async () => {
  const validation = Promise.withResolvers<boolean>()
  mocks.current.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockReturnValue(validation.promise)
  const { owner, watchers, registrations } = fixture()
  expect(registrations).toHaveLength(1)
  await until(() => watchers.length === 1)
  let ready = false
  void registrations[0]!.then(() => {
    ready = true
  })
  watchers[0]!.emit('ready')
  await until(() => mocks.current.mock.calls.length === 3)
  expect(ready).toBe(false)
  validation.resolve(true)
  await expect(registrations[0]).resolves.toBe('ready')
  await owner.close()
})

it('discards a root replaced during selection and scans a fresh plan before ready', async () => {
  mocks.current.mockResolvedValueOnce(false).mockResolvedValue(true)
  mocks.plan.mockResolvedValueOnce([plan()]).mockResolvedValueOnce([plan('/stable')])
  const { owner, watchers, registrations } = fixture()
  await until(() => watchers.length === 1)
  expect(mocks.watch.mock.calls.map(call => call[0])).toEqual(['/stable'])
  watchers[0]!.emit('ready')
  await expect(registrations[0]).resolves.toBe('ready')
  await owner.close()
})

it('cancels a root deleted during dispatch without waiting for its missing-path ready', async () => {
  mocks.current.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true)
  mocks.plan.mockResolvedValueOnce([plan()]).mockResolvedValueOnce([plan('/stable')])
  const { owner, watchers, registrations } = fixture()
  await until(() => watchers.length === 2)
  expect(watchers[0]!.close).toHaveBeenCalledOnce()
  expect(mocks.watch.mock.calls.map(call => call[0])).toEqual(['/anchor', '/stable'])
  watchers[1]!.emit('ready')
  await expect(registrations[0]).resolves.toBe('ready')
  await owner.close()
})

it('closes a deleted physical root synchronously and replans without waiting for a replacement event', async () => {
  const { owner, watchers, registrations, event } = fixture()
  await until(() => watchers.length === 1)
  watchers[0]!.emit('ready')
  await registrations[0]
  mocks.plan.mockResolvedValueOnce([plan('/')])
  watchers[0]!.emit('all', 'unlinkDir', '/anchor')
  expect(watchers[0]!.close).toHaveBeenCalledOnce()
  expect(registrations).toHaveLength(2)
  expect(event).not.toHaveBeenCalled()
  await until(() => watchers.length === 2)
  watchers[0]!.emit('all', 'change', '/anchor/project/a.js')
  expect(event).not.toHaveBeenCalled()
  watchers[1]!.emit('ready')
  await expect(registrations[1]).resolves.toBe('ready')
  watchers[1]!.emit('all', 'addDir', '/anchor')
  watchers[1]!.emit('all', 'change', '/anchor/project/a.js')
  expect(event).toHaveBeenLastCalledWith('change', '/anchor/project/a.js', undefined)
  await owner.close()
})

it('drains cancelled asynchronous selection and never opens a watcher after close', async () => {
  const planning = Promise.withResolvers<PhysicalViteWatchPlan[]>()
  mocks.plan.mockReturnValue(planning.promise)
  const { owner, watchers, registrations } = fixture()
  await until(() => mocks.plan.mock.calls.length === 1)
  let closed = false
  const closing = owner.close().then(() => {
    closed = true
  })
  await Promise.resolve()
  expect(closed).toBe(false)
  planning.resolve([plan()])
  await closing
  await expect(registrations[0]).resolves.toBe('closed')
  expect(watchers).toHaveLength(0)
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps original registration and close errors and retains failed physical owner evidence', async () => {
  const { owner, watchers, registrations } = fixture()
  await until(() => watchers.length === 1)
  const original = new Error('native registration failed')
  const cleanup = new Error('native close failed')
  watchers[0]!.close.mockRejectedValue(cleanup)
  watchers[0]!.emit('error', original)
  await expect(registrations[0]).rejects.toBe(original)
  await expect(owner.close()).rejects.toBe(cleanup)
  expect(owner.closeFailures()).toEqual([{ targets: ['/anchor/project'], error: cleanup, lateErrors: [] }])
  const late = new Error('late native error')
  watchers[0]!.emit('error', late)
  expect(owner.closeFailures()[0]!.lateErrors).toEqual([late])
  expect(watchers[0]!.eventNames()).toEqual(['error'])
})

it('retains a failed physical plan without creating a watcher or claiming readiness', async () => {
  const original = new Error('physical directory lookup failed')
  mocks.plan.mockRejectedValue(original)
  const { owner, watchers, registrations } = fixture()
  await expect(registrations[0]).rejects.toBe(original)
  expect(watchers).toHaveLength(0)
  await owner.close()
})

it('passes active exclusions into late plans without creating an unwatched owner', async () => {
  const planning = Promise.withResolvers<PhysicalViteWatchPlan[]>()
  mocks.plan.mockImplementation(async (_targets: string[], _options: ChokidarOptions, accepts: (file: string) => boolean) => {
    await planning.promise
    return accepts('/anchor/project') ? [plan()] : []
  })
  const { owner, watchers, registrations, accepts } = fixture()
  await until(() => mocks.plan.mock.calls.length === 1)
  accepts.mockReturnValue(false)
  owner.unwatch(['/anchor/project'])
  planning.resolve([plan()])
  await expect(registrations[0]).resolves.toBe('ready')
  expect(watchers).toHaveLength(0)
  expect(owner.getWatched()).toEqual([])
  await owner.close()
})
