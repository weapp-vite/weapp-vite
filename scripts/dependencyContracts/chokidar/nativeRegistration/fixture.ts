import type { FSWatcher as ChokidarWatcher } from 'chokidar'
import type { Stats } from 'node:fs'
import fs from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NativeRegistrationSource } from './source'

type WatchOptions = NonNullable<ConstructorParameters<typeof ChokidarWatcher>[0]>

export async function bounded<T>(promise: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Native registration fixture timed out: ${label}`)), 2000)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

function createOwner(watcher: ChokidarWatcher) {
  const errors: unknown[] = []
  const changes: string[] = []
  const raw: unknown[][] = []
  let readyCount = 0
  const ready = new Promise<void>(resolve => watcher.once('ready', resolve))
  const error = new Promise<unknown>(resolve => watcher.once('error', resolve))
  watcher.on('ready', () => {
    readyCount += 1
  })
  watcher.on('error', value => errors.push(value))
  watcher.on('change', file => changes.push(file))
  watcher.on('raw', (...values) => raw.push(values))
  return {
    watcher,
    errors,
    changes,
    raw,
    get readyCount() { return readyCount },
    ready: () => bounded(ready, 'public ready'),
    error: () => bounded(error, 'original native error'),
    async change(file: string, size: number) {
      let resolveChange: () => void = () => {}
      const waiting = new Promise<void>((resolve) => {
        resolveChange = resolve
      })
      const receive = (changed: string, stats?: Stats) => {
        if (changed === file && stats?.size === size) {
          resolveChange()
        }
      }
      watcher.on('change', receive)
      try {
        await bounded(waiting, 'the sole real file write')
      }
      finally {
        watcher.off('change', receive)
      }
    },
    async settle() {
      await bounded(watcher.lifecycle.drain(), 'owner reconciliation drain')
      await new Promise<void>(resolve => setImmediate(resolve))
    },
  }
}

export type NativeOwner = ReturnType<typeof createOwner>

export interface NativeFixture {
  root: string
  source: NativeRegistrationSource
  prepare: (relative: string, value?: string) => Promise<string>
  open: (target: string, options?: WatchOptions) => NativeOwner
}

export async function withNativeRegistrationFixture(run: (fixture: NativeFixture) => Promise<void>) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'chokidar-native-registration-')))
  const source = new NativeRegistrationSource(root)
  const originalWatch = fs.watch
  const owners: NativeOwner[] = []
  let runFailed = false
  let runError: unknown
  const failures: unknown[] = []
  // 源模型只提供 fs.watch 的公开使用面；注入边界不冒充真实原生句柄类型。
  fs.watch = source.watch as unknown as typeof fs.watch
  try {
    syncBuiltinESMExports()
    const require = createRequire(import.meta.url)
    const { FSWatcher } = await import(pathToFileURL(require.resolve('chokidar')).href) as typeof import('chokidar')
    await run({
      root,
      source,
      async prepare(relative, value = '{"value":"initial"}') {
        const file = path.join(root, relative)
        await mkdir(path.dirname(file), { recursive: true })
        await writeFile(file, value)
        return file
      },
      open(target, options = {}) {
        const watcher = new FSWatcher({ backend: 'native', atomic: false, awaitWriteFinish: false, ...options })
        const owner = createOwner(watcher)
        owners.push(owner)
        watcher.add(target)
        return owner
      },
    })
  }
  catch (error) {
    runFailed = true
    runError = error
  }
  finally {
    try {
      const cleanup = await bounded(Promise.allSettled(owners.map(owner => Promise.resolve().then(() => owner.watcher.close()))), 'owner cleanup')
      failures.push(...cleanup.filter(result => result.status === 'rejected').map(result => result.reason))
    }
    catch (error) {
      failures.push(error)
    }
    finally {
      try {
        fs.watch = originalWatch
        syncBuiltinESMExports()
      }
      catch (error) {
        failures.push(error)
      }
      try {
        await rm(root, { recursive: true, force: true })
      }
      catch (error) {
        failures.push(error)
      }
    }
  }
  if (failures.length) {
    throw new AggregateError(runFailed ? [runError, ...failures] : failures, 'Native registration fixture owner cleanup failed')
  }
  if (runFailed) {
    throw runError
  }
}
