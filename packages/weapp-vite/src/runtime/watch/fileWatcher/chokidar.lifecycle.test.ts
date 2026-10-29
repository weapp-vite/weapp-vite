import type { FileWatcher } from './types'
import { EventEmitter } from 'node:events'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileWatcher } from './index'

const mocks = vi.hoisted(() => ({ watch: vi.fn() }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))

const config = { inlineConfig: { weapp: { watch: { engine: 'chokidar' as const } } } }
const watchers = new Set<FileWatcher>()
const releases = new Set<() => void>()
const expectedFailures = new Set<unknown>()
const resources: Array<ReturnType<typeof resource>> = []

function resource() {
  const watcher = Object.assign(new EventEmitter(), {
    unwatch: vi.fn(),
    close: vi.fn(async () => {
      watcher.removeAllListeners()
    }),
  })
  return watcher
}

function own(targets: string | string[] = path.resolve('watcher-lifecycle/src')) {
  const watcher = createFileWatcher(config, targets, { ignoreInitial: true })
  watchers.add(watcher)
  return watcher
}

function leafErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
}

beforeEach(() => {
  mocks.watch.mockReset()
  mocks.watch.mockImplementation(() => {
    const watcher = resource()
    resources.push(watcher)
    return watcher
  })
})

afterEach(async () => {
  for (const release of releases) {
    release()
  }
  releases.clear()
  const results = await Promise.allSettled([...watchers].map(watcher => watcher.close()))
  watchers.clear()
  resources.length = 0
  const unexpected = results.flatMap(result => result.status === 'rejected'
    ? leafErrors(result.reason).filter(error => !expectedFailures.has(error))
    : [])
  expectedFailures.clear()
  expect(unexpected).toEqual([])
})

describe('Chokidar readiness and shutdown ownership', () => {
  it.each([false, true])('retains registration failure when close follows the error synchronously (cleanup failure: %s)', async (failedCleanup) => {
    const watcher = own()
    const raw = resources[0]!
    const failure = new Error('registration failed before caller close')
    const cleanupFailure = new Error('watcher release failed')
    const entered = Promise.withResolvers<void>()
    const stopped = Promise.withResolvers<void>()
    releases.add(stopped.resolve)
    expectedFailures.add(failure)
    if (failedCleanup) {
      expectedFailures.add(cleanupFailure)
    }
    raw.close.mockImplementation(async () => {
      entered.resolve()
      await stopped.promise
      raw.removeAllListeners()
      if (failedCleanup) {
        throw cleanupFailure
      }
    })
    let readiness: PromiseSettledResult<unknown> | undefined
    const observedReady = watcher.ready.then(
      value => readiness = { status: 'fulfilled', value },
      reason => readiness = { status: 'rejected', reason },
    )
    raw.emit('error', failure)
    const closing = watcher.close()
    const outcome = closing.then(() => undefined, error => error as unknown)
    expect(watcher.close()).toBe(closing)
    await entered.promise
    expect(readiness).toBeUndefined()
    expect(raw.close).toHaveBeenCalledOnce()
    stopped.resolve()
    const closeFailure = await outcome
    const readyResult = await observedReady
    expect(readyResult.status).toBe('rejected')
    expect('reason' in readyResult ? readyResult.reason : undefined).toBe(failure)
    const failures = leafErrors(closeFailure)
    expect(failures).toHaveLength(failedCleanup ? 2 : 1)
    expect(failures[0]).toBe(failure)
    if (failedCleanup) {
      expect(failures[1]).toBe(cleanupFailure)
    }
    expect(watcher.close()).toBe(closing)
    await expect(watcher.close()).rejects.toBe(closeFailure)
    expect(raw.eventNames()).toEqual([])
  })

  it('automatically drains failed initialization before delivering ready and preserves the same close result', async () => {
    const watcher = own()
    const raw = resources[0]!
    const failure = new Error('registration failed without caller close')
    const entered = Promise.withResolvers<void>()
    const stopped = Promise.withResolvers<void>()
    releases.add(stopped.resolve)
    expectedFailures.add(failure)
    raw.close.mockImplementation(async () => {
      entered.resolve()
      await stopped.promise
      raw.removeAllListeners()
    })
    const onError = vi.fn()
    watcher.onError(onError)
    let readiness: PromiseSettledResult<unknown> | undefined
    const outcome = watcher.ready.then(
      value => readiness = { status: 'fulfilled', value },
      reason => readiness = { status: 'rejected', reason },
    )
    raw.emit('error', failure)
    await entered.promise
    expect(readiness).toBeUndefined()
    stopped.resolve()
    const readyResult = await outcome
    expect(readyResult.status).toBe('rejected')
    expect('reason' in readyResult ? readyResult.reason : undefined).toBe(failure)
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]![0]).toBe(failure)
    const closing = watcher.close()
    expect(watcher.close()).toBe(closing)
    await expect(closing).rejects.toBe(failure)
    expect(raw.close).toHaveBeenCalledOnce()
    expect(raw.eventNames()).toEqual([])
  })

  it('settles a scan closed first as closed while joining its pending release', async () => {
    const watcher = own()
    const raw = resources[0]!
    const stopped = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    releases.add(stopped.resolve)
    raw.close.mockImplementation(async () => {
      entered.resolve()
      await stopped.promise
      raw.removeAllListeners()
    })
    const onError = vi.fn()
    watcher.onError(onError)
    const closing = watcher.close()
    expect(watcher.close()).toBe(closing)
    let closed = false
    const outcome = closing.then(() => closed = true)
    await entered.promise
    await expect(watcher.ready).resolves.toBe('closed')
    expect(closed).toBe(false)
    expect(onError).not.toHaveBeenCalled()
    stopped.resolve()
    await outcome
    await expect(watcher.add(path.resolve('watcher-lifecycle/other'))).resolves.toBe('closed')
    expect(raw.close).toHaveBeenCalledOnce()
    expect(mocks.watch).toHaveBeenCalledOnce()
    expect(raw.eventNames()).toEqual([])
  })

  it('keeps runtime errors distinct from an already completed initial scan', async () => {
    const watcher = own()
    const raw = resources[0]!
    raw.emit('ready')
    await expect(watcher.ready).resolves.toBe('ready')
    const onError = vi.fn()
    watcher.onError(onError)
    const failure = new Error('runtime event stream failed')
    raw.emit('error', failure)
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]![0]).toBe(failure)
    expect(raw.close).not.toHaveBeenCalled()
    await expect(watcher.close()).resolves.toBeUndefined()
    await expect(watcher.ready).resolves.toBe('ready')
    expect(raw.close).toHaveBeenCalledOnce()
  })
})

describe('Chokidar absolute path ownership', () => {
  it.each([
    { root: '//server/share/watch-fixture/src', aliases: ['\\\\server\\share\\watch-fixture\\src', '\\\\?\\UNC\\server\\share\\watch-fixture\\src'] },
    { root: 'C:/watch-fixture/src', aliases: ['C:\\watch-fixture\\src', '\\\\?\\C:\\watch-fixture\\src'] },
  ])('preserves target and event identity for $root', async ({ root, aliases }) => {
    const watcher = own([root, ...aliases])
    expect(mocks.watch.mock.calls[0]![0]).toEqual([root])
    const raw = resources[0]!
    raw.emit('ready')
    await watcher.ready
    const onChange = vi.fn()
    watcher.onChange(onChange)
    for (const spelling of [root, ...aliases]) {
      raw.emit('add', `${spelling}/pages/home.json`)
    }
    expect(onChange.mock.calls.map(([batch]) => batch)).toEqual([root, ...aliases].map(() => [{
      event: 'create',
      file: `${root}/pages/home.json`,
      kind: 'file',
    }]))
  })
})
