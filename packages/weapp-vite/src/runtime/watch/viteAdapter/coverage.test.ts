import type { ChokidarOptions } from 'chokidar'
import type { Stats } from 'node:fs'
import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createViteWatcherBackend } from './backend'

const mocks = vi.hoisted(() => ({ watch: vi.fn(), stat: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('node:fs/promises', () => ({ stat: mocks.stat }))

const directory = { dev: 1, ino: 1, isDirectory: () => true } as Stats
const file = { dev: 1, ino: 2, isDirectory: () => false } as Stats

class Watcher extends EventEmitter {
  unwatch = vi.fn()
  close = vi.fn(async () => { this.removeAllListeners() })
  getWatched = vi.fn(() => ({}))
  constructor(readonly options: ChokidarOptions) {
    super()
  }

  ignored(path: string, stats?: Stats) {
    return (this.options.ignored as (file: string, stats?: Stats) => boolean)(path, stats)
  }
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }
  throw new Error('Mock logical coverage did not reach the expected phase')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.stat.mockResolvedValue(directory)
})
afterEach(() => vi.useRealTimers())

it('lets an explicit child own events when a broader group pruned its parent directory', async () => {
  const watchers: Watcher[] = []
  mocks.watch.mockImplementation((_root: string, options: ChokidarOptions) => {
    const watcher = new Watcher(options)
    watchers.push(watcher)
    return watcher
  })
  const facade = new EventEmitter() as ViteDevServer['watcher']
  facade.options = {}
  const owner = createViteWatcherBackend(facade, ['/project'], {
    ignored: path => path === '/project/ignored',
    persistent: false,
  }, false)
  await until(() => watchers.length === 1)
  expect(watchers[0]!.ignored('/project', directory)).toBe(false)
  expect(watchers[0]!.ignored('/project/ignored', directory)).toBe(true)
  watchers[0]!.emit('ready')
  await owner.activate()
  const change = vi.fn()
  facade.on('change', change)
  facade.add('/project/ignored/explicit.js')
  await until(() => watchers.length === 2)
  expect(watchers[1]!.ignored('/project/ignored', directory)).toBe(false)
  expect(watchers[1]!.ignored('/project/ignored/explicit.js', file)).toBe(false)
  watchers[1]!.emit('ready')
  await owner.registrationReady()
  watchers[1]!.emit('all', 'change', '/project/ignored/explicit.js')
  expect(change).toHaveBeenCalledExactlyOnceWith('/project/ignored/explicit.js')
  await owner.close()
})

it('keeps siblings pruned when one group needs a synthetic route to an explicit child', async () => {
  const watchers: Watcher[] = []
  mocks.watch.mockImplementation((_root: string, options: ChokidarOptions) => {
    const watcher = new Watcher(options)
    watchers.push(watcher)
    return watcher
  })
  const facade = new EventEmitter() as ViteDevServer['watcher']
  facade.options = {}
  const owner = createViteWatcherBackend(facade, ['/project', '/project/ignored/explicit.js'], {
    ignored: path => path === '/project/ignored',
    persistent: false,
  }, false)
  await until(() => watchers.length === 1)
  const watcher = watchers[0]!
  expect(watcher.ignored('/project', directory)).toBe(false)
  expect(watcher.ignored('/project/ignored', directory)).toBe(false)
  expect(watcher.ignored('/project/ignored/explicit.js', file)).toBe(false)
  expect(watcher.ignored('/project/ignored/sibling.js', file)).toBe(true)
  watcher.emit('ready')
  await owner.activate()
  await owner.close()
})

it('keeps the earlier active root delivering while an overlapping child is still registering', async () => {
  const watchers: Watcher[] = []
  mocks.watch.mockImplementation((_root: string, options: ChokidarOptions) => {
    const watcher = new Watcher(options)
    watchers.push(watcher)
    return watcher
  })
  const facade = new EventEmitter() as ViteDevServer['watcher']
  facade.options = {}
  const owner = createViteWatcherBackend(facade, ['/project'], { persistent: false }, false)
  await until(() => watchers.length === 1)
  watchers[0]!.emit('ready')
  await owner.activate()
  const change = vi.fn()
  facade.on('change', change)
  facade.add('/project/explicit.js')
  await until(() => watchers.length === 2)
  watchers[0]!.emit('all', 'change', '/project/explicit.js')
  expect(change).toHaveBeenCalledExactlyOnceWith('/project/explicit.js')
  watchers[1]!.emit('ready')
  await owner.registrationReady()
  watchers[1]!.emit('all', 'change', '/project/explicit.js')
  expect(change).toHaveBeenCalledTimes(1)
  await owner.close()
})

it('decides ownership of environment-init events after the earlier root finishes its scan', async () => {
  const watchers: Watcher[] = []
  mocks.watch.mockImplementation((_root: string, options: ChokidarOptions) => {
    const watcher = new Watcher(options)
    watchers.push(watcher)
    return watcher
  })
  const facade = new EventEmitter() as ViteDevServer['watcher']
  facade.options = {}
  const owner = createViteWatcherBackend(facade, ['/project'], {
    ignored: path => path === '/project/ignored',
    persistent: false,
  }, false)
  await until(() => watchers.length === 1)
  const change = vi.fn()
  facade.on('change', change)
  facade.add('/project/ignored/explicit.js')
  await until(() => watchers.length === 2)
  expect(watchers[1]!.ignored('/project/ignored/explicit.js', file)).toBe(false)
  watchers[1]!.emit('all', 'change', '/project/ignored/explicit.js')
  expect(change).not.toHaveBeenCalled()
  expect(watchers[0]!.ignored('/project/ignored', directory)).toBe(true)
  watchers[0]!.emit('ready')
  watchers[1]!.emit('ready')
  await owner.activate()
  expect(change).toHaveBeenCalledExactlyOnceWith('/project/ignored/explicit.js')
  await owner.close()
})
