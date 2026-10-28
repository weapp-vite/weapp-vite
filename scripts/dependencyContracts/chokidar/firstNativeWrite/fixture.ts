import type { FSWatcher as ChokidarWatcher } from 'chokidar'
import type { FSWatcher as NativeWatcher, WatchEventType, WatchListener } from 'node:fs'
import { EventEmitter, once } from 'node:events'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect } from 'vitest'

interface NativeSubscription {
  file: string
  listener: WatchListener<string>
  closed: boolean
  closeCalls: number
}

interface Backend {
  setNativeWatchFactoryForTests: (factory?: (
    file: string,
    options: { persistent: boolean | undefined },
    listener: WatchListener<string>,
  ) => NativeWatcher) => void
}

interface Fixture {
  file: string
  root: string
  watcher: ChokidarWatcher
  changes: string[]
  resources: () => string[]
  deliver: (resource: string, name: string | null, event?: WatchEventType, includeClosed?: boolean) => void
}

const require = createRequire(import.meta.url)
const entry = require.resolve('chokidar')
const backendUrl = pathToFileURL(path.join(path.dirname(entry), 'backend.js')).href
const backend = await import(backendUrl) as Backend
const chokidar = await import(pathToFileURL(entry).href) as typeof import('chokidar')
// 捕获真实计时器，让模拟 policy throttle 的用例仍有独立的等待与清理上界。
const scheduleDeadline = setTimeout
const cancelDeadline = clearTimeout

export function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

export async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = scheduleDeadline(() => reject(new Error(`First-write fixture timed out: ${label}`)), 2000)
      }),
    ])
  }
  finally {
    cancelDeadline(timer)
  }
}

export async function withFixture(scope: 'file' | 'directory', run: (fixture: Fixture) => Promise<void>, options: { initialFiles?: string[] } = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'chokidar-first-write-')))
  const file = path.join(root, 'sitemap.json')
  const subscriptions: NativeSubscription[] = []
  let watcher: ChokidarWatcher | undefined
  let runFailed = false
  let runError: unknown
  try {
    await writeFile(file, '{"desc":"initial"}')
    await writeFile(path.join(root, 'unrelated.js'), 'export {}')
    await Promise.all((options.initialFiles ?? []).map(name => writeFile(path.join(root, name), '{"untouched":true}')))
    // 这是受控回调模型，不模拟原生流的注册握手，也不假定目录通知永久丢失。
    backend.setNativeWatchFactoryForTests((resource, _options, listener) => {
      const subscription = { file: resource, listener, closed: false, closeCalls: 0 }
      subscriptions.push(subscription)
      class Handle extends EventEmitter {
        close() {
          subscription.closed = true
          subscription.closeCalls += 1
          this.emit('close')
        }

        ref() { return this }
        unref() { return this }
      }
      return new Handle() as unknown as NativeWatcher
    })
    const changes: string[] = []
    watcher = chokidar.watch(scope === 'file' ? file : root, {
      backend: 'native',
      atomic: false,
      awaitWriteFinish: false,
      ignored: (candidate, stats) => Boolean(stats?.isFile() && !candidate.endsWith('.json')),
    })
    watcher.on('change', changed => changes.push(path.relative(root, changed).replaceAll('\\', '/')))
    await bounded(once(watcher, 'ready'), 'public ready')
    expect(watcher.getWatched()[root]).toContain('sitemap.json')
    expect(subscriptions.some(subscription => subscription.file === root && !subscription.closed)).toBe(true)
    await run({
      root,
      file,
      watcher,
      changes,
      resources: () => subscriptions.filter(subscription => !subscription.closed).map(subscription => path.relative(root, subscription.file).replaceAll('\\', '/') || '.'),
      deliver(resource, name, event = 'change', includeClosed = false) {
        const selected = subscriptions.filter(subscription => subscription.file === resource && (includeClosed || !subscription.closed))
        expect(selected.length).toBeGreaterThan(0)
        for (const subscription of selected) {
          subscription.listener(event, name)
        }
      },
    })
  }
  catch (error) {
    runFailed = true
    runError = error
  }
  const failures: unknown[] = []
  let closed = false
  try {
    await bounded(watcher?.close() ?? Promise.resolve(), 'owned watcher cleanup')
    expect(subscriptions.every(subscription => subscription.closed)).toBe(true)
    expect(subscriptions.every(subscription => subscription.closeCalls === 1)).toBe(true)
    closed = true
  }
  catch (error) {
    failures.push(error)
  }
  try {
    backend.setNativeWatchFactoryForTests()
  }
  catch (error) {
    failures.push(error)
  }
  if (closed) {
    try {
      await bounded(rm(root, { recursive: true, force: true }), 'fixture removal')
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) {
    throw new AggregateError(runFailed ? [runError, ...failures] : failures, 'First-write fixture cleanup failed; unclosed fixture files are preserved')
  }
  if (runFailed) {
    throw runError
  }
}
