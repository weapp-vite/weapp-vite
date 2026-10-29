import type { SubscribeCallback } from '@parcel/watcher'
import type { FileWatchEngine, FileWatcher } from './fileWatcher'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileWatcher } from './fileWatcher'

const mocks = vi.hoisted(() => ({ watch: vi.fn(), subscribe: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('@parcel/watcher', () => ({ subscribe: mocks.subscribe }))

function createChokidarResource(targets: string[], failure?: Error, registration?: Promise<void>) {
  const watcher = Object.assign(new EventEmitter(), {
    targets,
    close: vi.fn(async () => {}),
    unwatch: vi.fn(),
  })
  const announce = () => queueMicrotask(() => failure ? watcher.emit('error', failure) : watcher.emit('ready'))
  if (registration) {
    void registration.then(announce)
  }
  else {
    announce()
  }
  return watcher
}

function createParcelResource(directory: string, callback: SubscribeCallback) {
  return { directory, callback, unsubscribe: vi.fn(async () => {}) }
}

const rawChokidar: ReturnType<typeof createChokidarResource>[] = []
const rawParcel: ReturnType<typeof createParcelResource>[] = []
const owners = new Set<FileWatcher>()
const releases = new Set<() => void>()
let root: string

function own(engine: FileWatchEngine, target: string) {
  const watcher = createFileWatcher(engine, target, { ignoreInitial: true })
  owners.add(watcher)
  return watcher
}

async function inputs() {
  const files = ['original', 'added', 'last'].map(name => path.join(root, name, 'input.js'))
  await Promise.all(files.map(file => mkdir(path.dirname(file))))
  await Promise.all(files.map(file => writeFile(file, 'before')))
  return files as [string, string, string]
}

async function notify(engine: FileWatchEngine, file: string, contents: string) {
  await writeFile(file, contents)
  if (engine === 'chokidar') {
    const stats = await stat(file)
    for (const watcher of rawChokidar.filter(watcher => !watcher.close.mock.calls.length && watcher.targets.includes(file))) {
      watcher.emit('change', file, stats)
    }
  }
  else {
    for (const subscription of rawParcel.filter(subscription => !subscription.unsubscribe.mock.calls.length && subscription.directory === path.dirname(file))) {
      subscription.callback(null, [{ type: 'update', path: file }])
    }
  }
}

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'watcher-targets-')))
  rawChokidar.length = 0
  rawParcel.length = 0
  mocks.watch.mockReset()
  mocks.subscribe.mockReset()
  mocks.watch.mockImplementation((targets: string[]) => {
    const watcher = createChokidarResource(targets)
    rawChokidar.push(watcher)
    return watcher
  })
  mocks.subscribe.mockImplementation(async (directory: string, callback: SubscribeCallback) => {
    const subscription = createParcelResource(directory, callback)
    rawParcel.push(subscription)
    return subscription
  })
})

afterEach(async () => {
  releases.forEach(release => release())
  releases.clear()
  const results = await Promise.allSettled([...owners].map(watcher => watcher.close()))
  owners.clear()
  await rm(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
  expect(results.filter(result => result.status === 'rejected')).toEqual([])
})

it.each(['chokidar', 'parcel'] as const)('selects the explicit experimental %s engine independently of legacy overrides', async (engine) => {
  vi.stubEnv('WEAPP_VITE_WATCH_ENGINE', 'unsupported')
  const [original] = await inputs()
  const watcher = own(engine, original)
  await watcher.ready
  expect(mocks.watch).toHaveBeenCalledTimes(engine === 'chokidar' ? 1 : 0)
  expect(mocks.subscribe).toHaveBeenCalledTimes(engine === 'parcel' ? 1 : 0)
})

describe.each(['chokidar', 'parcel'] as const)('%s dynamic target transactions', (engine) => {
  it.each(['add', 'updateTargets'] as const)('rolls back failed %s and retries the same targets without interrupting the original owner', async (operation) => {
    const [original, added, last] = await inputs()
    const watcher = own(engine, original)
    await watcher.ready
    const onChange = vi.fn()
    watcher.onChange(onChange)
    const failure = new Error('Dynamic registration failed')
    const registration = Promise.withResolvers<void>()
    releases.add(registration.resolve)
    let failedChokidar: ReturnType<typeof createChokidarResource> | undefined
    if (engine === 'chokidar') {
      mocks.watch.mockImplementationOnce((targets: string[]) => {
        failedChokidar = createChokidarResource(targets, failure, registration.promise)
        rawChokidar.push(failedChokidar)
        return failedChokidar
      })
    }
    else {
      mocks.subscribe.mockImplementationOnce(async (directory: string, callback: SubscribeCallback) => {
        const subscription = createParcelResource(directory, callback)
        rawParcel.push(subscription)
        return subscription
      }).mockImplementationOnce(async () => {
        await registration.promise
        throw failure
      })
    }
    const rejected = expect(watcher[operation]([added, last])).rejects.toBe(failure)
    await vi.waitFor(() => expect(engine === 'chokidar' ? mocks.watch : mocks.subscribe).toHaveBeenCalledTimes(engine === 'chokidar' ? 2 : 3))
    await notify(engine, original, 'saved-during-failed-registration')
    registration.resolve()
    await rejected
    if (engine === 'chokidar') {
      expect(failedChokidar?.close).toHaveBeenCalledOnce()
      expect(rawChokidar[0]?.close).not.toHaveBeenCalled()
    }
    else {
      expect(rawParcel[1]?.unsubscribe).toHaveBeenCalledOnce()
      expect(rawParcel[0]?.unsubscribe).not.toHaveBeenCalled()
    }
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([{ event: 'update', file: original, kind: 'file' }]))
    onChange.mockClear()
    await expect(watcher[operation]([added, last])).resolves.toBe('ready')
    expect(engine === 'chokidar' ? mocks.watch : mocks.subscribe).toHaveBeenCalledTimes(engine === 'chokidar' ? 3 : 5)
    await notify(engine, added, 'saved-after-retry')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith([{ event: 'update', file: added, kind: 'file' }]))
    if (operation === 'add') {
      expect(engine === 'chokidar' ? rawChokidar[0]?.close : rawParcel[0]?.unsubscribe).not.toHaveBeenCalled()
    }
    else {
      expect(engine === 'chokidar' ? rawChokidar[0]?.close : rawParcel[0]?.unsubscribe).toHaveBeenCalledOnce()
    }
  })

  it('retains both the registration failure and rollback cleanup failure', async () => {
    const [original, added, last] = await inputs()
    const watcher = own(engine, original)
    await watcher.ready
    const failure = new Error('Dynamic registration failed')
    const cleanupFailure = new Error('Rollback cleanup failed')
    if (engine === 'chokidar') {
      mocks.watch.mockImplementationOnce((targets: string[]) => {
        const resource = createChokidarResource(targets, failure)
        resource.close.mockRejectedValue(cleanupFailure)
        rawChokidar.push(resource)
        return resource
      })
    }
    else {
      mocks.subscribe.mockImplementationOnce(async (directory: string, callback: SubscribeCallback) => {
        const resource = createParcelResource(directory, callback)
        resource.unsubscribe.mockRejectedValue(cleanupFailure)
        rawParcel.push(resource)
        return resource
      }).mockRejectedValueOnce(failure)
    }
    const outcome = await watcher.add([added, last]).catch((error: unknown) => error)
    expect(outcome).toBeInstanceOf(AggregateError)
    expect((outcome as AggregateError).errors).toEqual([failure, cleanupFailure])
    expect((outcome as AggregateError).cause).toBe(failure)
    await expect(watcher.close()).rejects.toBe(cleanupFailure)
    owners.delete(watcher)
  })
})

it('deduplicates stale Chokidar Stats against the current saved file version', async () => {
  const [original] = await inputs()
  const watcher = own('chokidar', original)
  await watcher.ready
  const onChange = vi.fn()
  watcher.onChange(onChange)
  await writeFile(original, '')
  const truncated = await stat(original)
  await writeFile(original, 'complete-save')
  rawChokidar[0]!.emit('change', original, truncated)
  rawChokidar[0]!.emit('change', original, await stat(original))
  expect(onChange).toHaveBeenCalledExactlyOnceWith([{ event: 'update', file: original, kind: 'file' }])
})

it('keeps host depth and filtering separate from explicit shared watcher options', async () => {
  const [original] = await inputs()
  const config = {
    inlineConfig: {
      server: { watch: { usePolling: false, depth: 0, persistent: false, ignored: /host-only/, awaitWriteFinish: true } },
    },
  }
  const inherited = createFileWatcher('chokidar', original, {}, config)
  owners.add(inherited)
  await inherited.ready
  expect(mocks.watch).toHaveBeenNthCalledWith(1, [original], { backend: 'native' })
  const ignored = /shared-explicit/
  const explicit = createFileWatcher('chokidar', original, {
    depth: 2,
    ignored,
    persistent: true,
    ignoreInitial: true,
    stability: { threshold: 30, interval: 5 },
  }, config)
  owners.add(explicit)
  await explicit.ready
  expect(mocks.watch).toHaveBeenNthCalledWith(2, [original], {
    backend: 'native',
    depth: 2,
    ignored,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 30, pollInterval: 5 },
  })
})
