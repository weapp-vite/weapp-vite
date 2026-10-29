import type { AsyncSubscription, SubscribeCallback } from '@parcel/watcher'
import type { FileWatcher } from './fileWatcher'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileWatcher } from './fileWatcher'

const mocks = vi.hoisted(() => ({ subscribe: vi.fn() }))
vi.mock('@parcel/watcher', () => ({ subscribe: mocks.subscribe }))

const parcelConfig = {
  inlineConfig: {
    weapp: { watch: { engine: 'parcel' as const } },
    server: { watch: { usePolling: false } },
  },
}
const watchers = new Set<FileWatcher>()
const releases = new Set<() => void>()
let root: string

function gate<T>() {
  return Promise.withResolvers<T>()
}

function resource() {
  const unsubscribe = vi.fn(async () => {})
  return { unsubscribe }
}

function own(targets: string | string[]) {
  const watcher = createFileWatcher(parcelConfig, targets, { ignoreInitial: true })
  watchers.add(watcher)
  return watcher
}

async function inputs() {
  const first = path.join(root, 'first/input.js')
  const second = path.join(root, 'second/input.js')
  await Promise.all([mkdir(path.dirname(first)), mkdir(path.dirname(second))])
  await Promise.all([writeFile(first, 'first'), writeFile(second, 'second')])
  return { first, second }
}

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'watcher-lifecycle-')))
  mocks.subscribe.mockReset()
  mocks.subscribe.mockImplementation(async () => resource())
})

afterEach(async () => {
  for (const release of releases) {
    release()
  }
  releases.clear()
  const results = await Promise.allSettled([...watchers].map(watcher => watcher.close()))
  watchers.clear()
  await rm(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
  expect(results.filter(result => result.status === 'rejected')).toEqual([])
})

describe('Parcel watcher lifecycle without native subscriptions', () => {
  it('releases a successful root before rejecting readiness after another root fails', async () => {
    const { first, second } = await inputs()
    const stopped = gate<void>()
    releases.add(stopped.resolve)
    const subscription = resource()
    subscription.unsubscribe.mockImplementation(() => stopped.promise)
    const failure = new Error('Second root registration failed')
    mocks.subscribe.mockResolvedValueOnce(subscription).mockRejectedValueOnce(failure)
    const watcher = own([first, second])
    const onError = vi.fn()
    watcher.onError(onError)
    let readySettled = false
    const outcome = watcher.ready.then(value => ({ value }), (error: unknown) => ({ error })).finally(() => {
      readySettled = true
    })
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledOnce())
    expect(readySettled).toBe(false)
    stopped.resolve()
    const result = await outcome
    expect('error' in result ? result.error : undefined).toBe(failure)
    expect(onError.mock.calls[0]?.[0]).toBe(failure)
    await expect(watcher.close()).resolves.toBeUndefined()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.subscribe).toHaveBeenCalledTimes(2)
  })

  it('joins a pending subscription and its release when close starts during registration', async () => {
    const { first } = await inputs()
    const subscribing = gate<AsyncSubscription>()
    const stopped = gate<void>()
    const subscription = resource()
    releases.add(() => subscribing.resolve(subscription))
    releases.add(stopped.resolve)
    subscription.unsubscribe.mockImplementation(() => stopped.promise)
    mocks.subscribe.mockImplementation(() => subscribing.promise)
    const watcher = own(first)
    await vi.waitFor(() => expect(mocks.subscribe).toHaveBeenCalledOnce())
    const closing = watcher.close()
    expect(watcher.close()).toBe(closing)
    await expect(watcher.ready).resolves.toBe('closed')
    let closed = false
    const observedClose = closing.then(() => {
      closed = true
    })
    subscribing.resolve(subscription)
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledOnce())
    expect(closed).toBe(false)
    stopped.resolve()
    await observedClose
    await expect(watcher.add(first)).resolves.toBe('closed')
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.subscribe).toHaveBeenCalledOnce()
  })

  it('reports the original runtime subscription error without changing its identity', async () => {
    const { first } = await inputs()
    const callbacks: SubscribeCallback[] = []
    const resources: ReturnType<typeof resource>[] = []
    mocks.subscribe.mockImplementation(async (_directory: string, callback: SubscribeCallback) => {
      callbacks.push(callback)
      const subscription = resource()
      resources.push(subscription)
      return subscription
    })
    const watcher = own(first)
    await watcher.ready
    const onError = vi.fn()
    const onChange = vi.fn()
    watcher.onError(onError)
    watcher.onChange(onChange)
    const failure = new Error('Native watch stream failed')
    callbacks[0]!(failure, [])
    expect(onError.mock.calls[0]?.[0]).toBe(failure)
    await watcher.close()
    expect(resources.every(subscription => subscription.unsubscribe.mock.calls.length === 1)).toBe(true)
    callbacks[0]!(failure, [{ type: 'update', path: first }])
    expect(onError).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reuses one release task when target retirement and owner close overlap', async () => {
    const { first, second } = await inputs()
    const retired = resource()
    const retained = resource()
    const stopped = gate<void>()
    releases.add(stopped.resolve)
    retired.unsubscribe.mockImplementation(() => stopped.promise)
    mocks.subscribe.mockImplementation(async (directory: string) => directory === path.dirname(first) ? retired : retained)
    const watcher = own([first, second])
    await watcher.ready
    const updating = watcher.updateTargets(second)
    await vi.waitFor(() => expect(retired.unsubscribe).toHaveBeenCalledOnce())
    const closing = watcher.close()
    let closed = false
    const observedClose = closing.then(() => {
      closed = true
    })
    await vi.waitFor(() => expect(retained.unsubscribe).toHaveBeenCalledOnce())
    expect(closed).toBe(false)
    expect(retired.unsubscribe).toHaveBeenCalledOnce()
    stopped.resolve()
    await Promise.all([updating, observedClose])
    expect(retired.unsubscribe).toHaveBeenCalledOnce()
    expect(retained.unsubscribe).toHaveBeenCalledOnce()
  })

  it('rejects polling explicitly before opening a subscription', () => {
    const config = { inlineConfig: { ...parcelConfig.inlineConfig, server: { watch: { usePolling: true } } } }
    expect(() => createFileWatcher(config, root, {})).toThrow('Parcel watcher does not support polling')
    expect(mocks.subscribe).not.toHaveBeenCalled()
  })

  it('rejects an invalid engine before opening a subscription', () => {
    vi.stubEnv('WEAPP_VITE_WATCH_ENGINE', 'invalid')
    expect(() => createFileWatcher({ inlineConfig: {} }, root, {})).toThrow('Unknown weapp.watch.engine')
    expect(mocks.subscribe).not.toHaveBeenCalled()
  })
})
