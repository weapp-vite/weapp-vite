import type { ChokidarOptions } from 'chokidar'
import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createViteWatcherBackend } from './backend'

const mocks = vi.hoisted(() => ({ watch: vi.fn(), plan: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('./physical', () => ({
  planPhysicalViteWatchTargets: mocks.plan,
  isPhysicalViteWatchPlanCurrent: async () => true,
}))

class Backend extends EventEmitter {
  unwatch = vi.fn()
  close = vi.fn(async () => { this.removeAllListeners() })
  getWatched = vi.fn((): Record<string, string[]> => ({ '/project': ['a.ts'] }))
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }
  throw new Error('Mock physical watcher did not reach the expected phase')
}

async function fixture(options: ChokidarOptions = {}, waitForWatcher = true) {
  const facade = new EventEmitter() as ViteDevServer['watcher']
  const watchers: Backend[] = []
  mocks.watch.mockImplementation(() => {
    const watcher = new Backend()
    watchers.push(watcher)
    return watcher
  })
  const owner = createViteWatcherBackend(facade, ['/project'], { persistent: false, ...options }, true)
  if (waitForWatcher) {
    await until(() => watchers.length === 1)
  }
  return { facade, owner, watchers }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.plan.mockImplementation(async (targets: string[], options: ChokidarOptions, accepts: (file: string) => boolean, active: () => boolean) => active()
    ? targets.filter(accepts).map(target => ({ root: target.slice(0, target.lastIndexOf('/')) || '/', targets: [target], options, identity: { dev: 1, ino: 1 }, reachable: (file: string) => file === target || file.startsWith(`${target}/`) }))
    : [])
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Vite public watcher backend', () => {
  it('queues early events and publishes ready only after the backing scan', async () => {
    const { owner, facade, watchers } = await fixture()
    const events: string[] = []
    facade.on('change', () => events.push('change'))
    facade.on('all', () => events.push('all'))
    facade.once('ready', () => events.push('ready'))
    const activated = owner.activate()
    watchers[0]!.emit('all', 'change', '/project/a.ts')
    expect(events).toEqual([])
    watchers[0]!.emit('ready')
    await expect(activated).resolves.toBe('ready')
    expect(events).toEqual(['change', 'all', 'ready'])
    await owner.activate()
    expect(events).toEqual(['change', 'all', 'ready'])
    expect(facade.ref()).toBe(facade)
    expect(facade.unref()).toBe(facade)
    await owner.close()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('tracks each external add, preserves raw payloads and merges watched directories', async () => {
    const { owner, facade, watchers } = await fixture()
    watchers[0]!.emit('ready')
    await owner.activate()
    expect(facade.add('/external/input.ts')).toBe(facade)
    await until(() => watchers.length === 2)
    expect(watchers).toHaveLength(2)
    watchers[1]!.getWatched.mockReturnValue({ '/external': ['input.ts'] })
    let registered = false
    const ready = owner.registrationReady().then(() => {
      registered = true
    })
    await Promise.resolve()
    expect(registered).toBe(false)
    watchers[1]!.emit('ready')
    await ready
    expect(facade.getWatched()).toEqual({ '/project': ['a.ts'], '/external': ['input.ts'] })
    const onRaw = vi.fn()
    facade.on('raw', onRaw)
    const details = { watchedPath: '/external' }
    watchers[1]!.emit('raw', 'rename', 'input.ts', details)
    expect(onRaw).toHaveBeenCalledExactlyOnceWith('rename', 'input.ts', details)
    const onChange = vi.fn()
    facade.on('change', onChange)
    facade.emit('change', '/project/synthetic.ts')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('/project/synthetic.ts')
    expect(facade.unwatch('/external')).toBe(facade)
    watchers[1]!.emit('all', 'change', '/external/input.ts')
    expect(onChange).toHaveBeenCalledTimes(1)
    await owner.close()
  })

  it('cancels startup and never reopens handles after close', async () => {
    const { owner, facade, watchers } = await fixture()
    const onReady = vi.fn()
    facade.on('ready', onReady)
    const ready = owner.activate()
    const closing = facade.close()
    expect(facade.close()).toBe(closing)
    await closing
    await expect(ready).resolves.toBe('closed')
    expect(onReady).not.toHaveBeenCalled()
    expect(facade.add('/late')).toBe(facade)
    expect(watchers).toHaveLength(1)
    expect(facade.getWatched()).toEqual({})
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes facade listeners and forwarding subscriptions even when backing close fails', async () => {
    const { owner, facade, watchers } = await fixture()
    watchers[0]!.emit('ready')
    await owner.activate()
    const change = vi.fn()
    facade.on('change', change)
    facade.on('raw', vi.fn())
    const original = new Error('backing close failed')
    watchers[0]!.close.mockImplementation(async () => {
      throw original
    })
    await expect(owner.close()).rejects.toBe(original)
    expect(facade.eventNames()).toEqual([])
    expect(watchers[0]!.eventNames()).toEqual(['error'])
    expect(owner.closeFailures()).toEqual([{ targets: ['/project'], error: original, lateErrors: [] }])
    const late = new Error('late backend error')
    watchers[0]!.emit('error', late)
    expect(owner.closeFailures()[0]!.lateErrors).toEqual([late])
    await expect(owner.registrationReady()).rejects.toBe(original)
    facade.emit('change', '/project/a.ts')
    expect(change).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears successful owner subscriptions and records no unconfirmed resources', async () => {
    const { owner, facade, watchers } = await fixture()
    watchers[0]!.emit('ready')
    await owner.activate()
    facade.on('change', vi.fn())
    await owner.close()
    expect(facade.eventNames()).toEqual([])
    expect(watchers[0]!.eventNames()).toEqual([])
    expect(owner.closeFailures()).toEqual([])
    await expect(owner.registrationReady()).resolves.toBe('closed')
  })

  it('retains the original registration error and cleanup failure separately', async () => {
    const { owner, facade, watchers } = await fixture()
    const registrationError = new Error('registration failed')
    const closeError = new Error('close failed')
    watchers[0]!.close.mockRejectedValue(closeError)
    const ready = owner.activate()
    watchers[0]!.emit('error', registrationError)
    await expect(ready).rejects.toBe(registrationError)
    await expect(facade.close()).rejects.toBe(closeError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains a late registration failure while close drains cancelled planning', async () => {
    const planning = Promise.withResolvers<never>()
    mocks.plan.mockReturnValueOnce(planning.promise)
    const { owner, watchers } = await fixture({}, false)
    await until(() => mocks.plan.mock.calls.length === 1)
    const ready = owner.registrationReady().catch((error: unknown) => error)
    const closing = owner.close().catch((error: unknown) => error)
    const original = new Error('late directory access failure')
    planning.reject(original)
    expect(await closing).toBe(original)
    expect(await ready).toBe(original)
    expect(watchers).toHaveLength(0)
    expect(owner.closeFailures()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('delivers an overlapping target through one owner and supports unwatch/add', async () => {
    const { owner, facade, watchers } = await fixture()
    watchers[0]!.emit('ready')
    await owner.activate()
    facade.add('/project/a.ts')
    await until(() => watchers.length === 2)
    watchers[1]!.emit('ready')
    await owner.registrationReady()
    const change = vi.fn()
    facade.on('change', change)
    watchers[0]!.emit('all', 'change', '/project/a.ts')
    watchers[1]!.emit('all', 'change', '/project/a.ts')
    expect(change).toHaveBeenCalledTimes(1)
    facade.unwatch('/project/a.ts').add('/project/a.ts')
    await until(() => watchers.length === 3)
    watchers[2]!.emit('ready')
    await owner.registrationReady()
    watchers[0]!.emit('all', 'change', '/project/a.ts')
    watchers[2]!.emit('all', 'change', '/project/a.ts')
    expect(change).toHaveBeenCalledTimes(2)
    await owner.close()
  })
})
