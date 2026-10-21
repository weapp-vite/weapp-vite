import type { ViteDevServer } from 'vite'
import { statSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it, onTestFailed, vi } from 'vitest'
import { weapp } from './index'

const harness = vi.hoisted(() => ({ pause: undefined as (() => Promise<void>) | undefined }))
vi.mock('../runtime/tsconfigSupport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/tsconfigSupport')>()
  return {
    ...actual,
    async syncManagedTsconfigFiles(...args: Parameters<typeof actual.syncManagedTsconfigFiles>) {
      const result = await actual.syncManagedTsconfigFiles(...args)
      await harness.pause?.()
      return result
    },
  }
})

/** Vite 创建 watcher 后还会异步初始化环境，configureServer 可能晚于唯一一次 ready。 */
function waitForStartupWatcherReady(watcher: ViteDevServer['watcher']) {
  const initialScan = watcher as ViteDevServer['watcher'] & { _readyEmitted?: boolean }
  if (typeof initialScan._readyEmitted !== 'boolean') {
    throw new TypeError('The Vite watcher does not expose its initial scan readiness')
  }
  return new Promise<void>((resolve, reject) => {
    let onReady: () => void
    let onError: (error: Error) => void
    const cleanup = () => {
      watcher.off('ready', onReady)
      watcher.off('error', onError)
    }
    onReady = () => {
      cleanup()
      resolve()
    }
    onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    watcher.once('ready', onReady)
    watcher.once('error', onError)
    if (initialScan._readyEmitted) {
      onReady()
    }
  })
}

it.each(['entry-validation', 'initial-build'] as const)('keeps source saves admitted during %s before the classic graph is ready', async (stage) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-startup-save-')))
  const appConfig = path.join(root, 'src/app.json')
  const paused = Promise.withResolvers<void>()
  const observed = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let phase = 'initial-files'
  let watcherServer: ViteDevServer | undefined
  let watcherReady = false
  const startedAt = performance.now()
  const hotUpdates: Array<{ file: string, matchesAppConfig: boolean }> = []
  const targetEvents: Array<Record<string, unknown>> = []
  let droppedTargetEvents = 0
  const normalizeTargetPath = (file: string) => {
    const resolved = path.resolve(file)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  const matchesTarget = (file: string) => normalizeTargetPath(file) === normalizeTargetPath(appConfig)
  const targetState = () => {
    let fileState: Record<string, unknown>
    try {
      const { size, atimeMs, mtimeMs, ctimeMs, dev, ino } = statSync(appConfig)
      fileState = { size, atimeMs, mtimeMs, ctimeMs, dev, ino }
    }
    catch (error) {
      fileState = { errorCode: (error as NodeJS.ErrnoException).code }
    }
    const watcher = watcherServer?.watcher as (ViteDevServer['watcher'] & {
      _throttled?: Map<string, Map<string, { count?: number }>>
    }) | undefined
    const throttles: Array<{ action: string, count?: number }> = []
    for (const [action, entries] of watcher?._throttled ?? []) {
      for (const [file, entry] of entries) {
        const base = action === 'change' ? watcher?.options.cwd ?? process.cwd() : process.cwd()
        if (matchesTarget(path.resolve(base, file))) {
          throttles.push({ action, count: entry.count })
        }
      }
    }
    return { elapsedMs: performance.now() - startedAt, fileState, throttles, watcherReady, watcherClosed: watcher?.closed }
  }
  const recordTargetEvent = (event: string, details?: Record<string, unknown>) => {
    if (targetEvents.length >= 32) {
      droppedTargetEvents++
      return
    }
    targetEvents.push({ event, phase, ...details, ...targetState() })
  }
  let beforeSave: ReturnType<typeof targetState> | undefined
  let afterSave: ReturnType<typeof targetState> | undefined
  onTestFailed(() => {
    process.stderr.write(`[startup-save-admission] ${JSON.stringify({
      stage,
      phase,
      watcherReady,
      serverRootMatchesFixture: watcherServer && path.resolve(watcherServer.config.root) === root,
      hotUpdates,
      beforeSave,
      afterSave,
      failureState: targetState(),
      targetEvents,
      droppedTargetEvents,
    })}\n`)
  })
  const pause = async () => {
    phase = 'admission-gate-held'
    paused.resolve()
    await release.promise
  }
  let server: ViteDevServer | undefined
  let starting: Promise<ViteDevServer> | undefined
  let firstBuild = true
  try {
    for (const [file, content] of Object.entries({
      'package.json': '{"name":"startup-save-fixture","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist"}',
      'src/app.js': 'App({})',
      'src/app.json': '{"pages":["pages/home/index"],"window":{"navigationBarTitleText":"before-startup-save"}}',
      'src/pages/home/index.js': 'Page({})',
      'src/pages/home/index.json': '{}',
      'src/pages/home/index.wxml': '<view>Startup save</view>',
    })) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), content)
    }
    harness.pause = stage === 'entry-validation' ? pause : undefined
    starting = createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'classic' } },
      server: { middlewareMode: true, host: '127.0.0.1', port: 0 },
      plugins: [{
        name: 'startup-save-watcher-readiness',
        configureServer: {
          order: 'pre',
          async handler(host) {
            watcherServer = host
            host.watcher.on('raw', (event, file, details: unknown) => {
              const watchedPath = details && typeof details === 'object' && 'watchedPath' in details && typeof details.watchedPath === 'string'
                ? details.watchedPath
                : undefined
              if ((typeof file === 'string' && matchesTarget(file))
                || (watchedPath && (matchesTarget(watchedPath) || (typeof file === 'string' && matchesTarget(path.resolve(watchedPath, file)))))) {
                recordTargetEvent('raw', { rawEvent: event, file: path.basename(String(file)), watchedPath: watchedPath && path.basename(watchedPath) })
              }
            })
            host.watcher.on('change', (file, stats) => {
              if (matchesTarget(file)) {
                recordTargetEvent('change', { emittedSize: stats?.size, emittedMtimeMs: stats?.mtimeMs })
              }
            })
            phase = 'watcher-initial-scan'
            await waitForStartupWatcherReady(host.watcher)
            watcherReady = true
            phase = 'waiting-for-admission-gate'
          },
        },
      }, weapp(), {
        name: 'startup-save-admission-gate',
        async buildStart() {
          if (stage === 'initial-build' && firstBuild && this.environment.mode === 'build') {
            firstBuild = false
            await pause()
          }
        },
        hotUpdate({ file }) {
          const matchesAppConfig = path.resolve(file) === appConfig
          hotUpdates.push({ file: path.basename(file), matchesAppConfig })
          if (hotUpdates.length > 16) {
            hotUpdates.shift()
          }
          if (matchesAppConfig) {
            recordTargetEvent('hot-update')
            observed.resolve()
          }
        },
      }],
    })
    await Promise.race([paused.promise, starting.then(() => {
      throw new Error('Startup completed before the admission gate')
    })])
    phase = 'saving-source-during-admission-gate'
    beforeSave = targetState()
    await writeFile(appConfig, '{"pages":["pages/home/index"],"window":{"navigationBarTitleText":"saved-during-startup"}}')
    afterSave = targetState()
    // 等到真实宿主消费文件事件，再释放扫描或首构，排除保存碰巧落在就绪后的假通过。
    phase = 'waiting-for-real-hot-update'
    await observed.promise
    phase = 'finishing-startup-after-save'
    release.resolve()
    server = await starting
    phase = 'checking-published-save'
    await expect.poll(() => readFile(path.join(root, 'dist/app.json'), 'utf8')).toContain('saved-during-startup')
  }
  finally {
    harness.pause = undefined
    release.resolve()
    server ??= await starting?.catch(() => undefined)
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})
