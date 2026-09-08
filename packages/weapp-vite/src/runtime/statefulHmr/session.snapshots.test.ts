import type { InlineConfig, Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrInitialPublicAssets, StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { tmpdir } from 'node:os'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { runStatefulHmrDev } from './session'
import { StatefulHmrTransport } from './transport'

interface AdapterCallbacks {
  onOutput: (output: StatefulHmrOutputFile[]) => void
  onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as AdapterCallbacks | undefined,
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[], initialPublicAssets?: StatefulHmrInitialPublicAssets) => Promise<void>>(),
  fullBuild: vi.fn<() => Promise<void>>(),
  beforeInitialReady: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: AdapterCallbacks) {
      harness.callbacks = callbacks
    }

    install() {}
    async registerBundleModules() { return 1 }
    async registerPatchModules() {}
    async markPayloadDelivered() {}
    async rebuild() { await harness.fullBuild() }
  },
}))

const route = 'pages/shared/index'
const styleFile = `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`
const root = path.join(tmpdir(), 'stateful-session-snapshots')
const watchers: Array<{ close: () => Promise<void> }> = []

function appOutput(): StatefulHmrOutputFile[] {
  return [{ type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} }]
}

function snapshot(color: string, routes: string[] = [route]): StatefulHmrSnapshot {
  return {
    output: [{ type: 'asset', fileName: 'app.wxss', source: `.probe { color: ${color}; }` }],
    componentPageGlobalStyleRoutes: routes,
  }
}

async function start(initial = snapshot('red')) {
  const rebuild = vi.fn(async (_files: string[]) => snapshot('blue'))
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      weappViteConfig: {},
    },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: { collectAffectedEntries: () => new Set() },
  } as unknown as MutableCompilerContext
  const watcher = await runStatefulHmrDev(ctx, { root }, vi.fn(async () => {}), { initial, entryIds: [], rebuild })
  watchers.push(watcher)
  return {
    rebuild,
    patch: (reasons: string[]) => {
      ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = reasons
      return harness.callbacks!.onPatch([path.join(root, 'src/page.vue')], { type: 'Patch', code: 'void 0', filename: 'update.js' })
    },
    refresh: () => ctx.onStatefulHmrSourceChange!(path.join(root, 'src/page.wxss'), []),
    full: () => harness.callbacks!.onPatch([path.join(root, 'src/page.vue')], { type: 'FullReload', reason: 'test boundary' }),
  }
}

function writtenAssets() {
  return harness.writeOutput.mock.calls.flatMap(([, output]) => output).filter(item => item.type === 'asset')
}

describe('stateful snapshot output transactions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    harness.writeOutput.mockReset().mockResolvedValue()
    harness.beforeInitialReady.mockReset().mockResolvedValue()
    harness.fullBuild.mockReset().mockImplementation(async () => {
      harness.callbacks!.onOutput(appOutput())
    })
    harness.createServer.mockImplementation(async (options: InlineConfig) => {
      const server = {
        config: {
          root: options.root,
          publicDir: path.join(root, 'static-assets'),
          build: { copyPublicDir: true },
          server: {},
          logger: { info: vi.fn(), error: vi.fn() },
        },
        moduleGraph: { getModulesByFile: () => undefined },
        middlewares: { use: vi.fn() },
        httpServer: { address: () => undefined },
        close: vi.fn().mockResolvedValue(undefined),
        async listen() {
          harness.callbacks!.onOutput(appOutput())
          await harness.beforeInitialReady()
          await harness.callbacks!.waitForInitialBundle()
        },
      }
      const plugin = options.plugins?.find(value => value && 'name' in value && value.name === 'weapp-vite:stateful-hmr-session') as Plugin
      ;(plugin.configureServer as (server: unknown) => void)(server)
      return server
    })
  })

  afterEach(async () => {
    await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('publishes a mixed visual edit as a patch plus changed assets without a full build', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    const session = await start()
    harness.writeOutput.mockClear()

    expect(session.patch(['entry-mixed-asset:1'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({
      fileName: `${route}.wxss`,
      source: expect.stringContaining('color: blue'),
    }))
    expect(delta).toHaveBeenCalledTimes(1)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('assigns resolved public publication only to the first complete output', async () => {
    const session = await start()
    const initialOutput = harness.writeOutput.mock.calls.find(([, output]) => output.some(item => item.fileName === 'app.js'))
    expect(initialOutput?.[2]).toEqual({ publicDir: path.join(root, 'static-assets'), copyPublicDir: true })
    const controls = harness.writeOutput.mock.calls.filter(([, output]) => !output.some(item => item.fileName === 'app.js'))
    expect(controls.every(([, , publicAssets]) => publicAssets === undefined)).toBe(true)

    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.length).toBeGreaterThan(0)
    expect(harness.writeOutput.mock.calls.some(([, output]) => output.some(item => item.fileName === 'app.js'))).toBe(true)
    expect(harness.writeOutput.mock.calls.every(([, , publicAssets]) => publicAssets === undefined)).toBe(true)
  })

  it('rejects a failed initial publication and publishes public assets on the next startup', async () => {
    const commit = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild')
    const initialPublicAssets = { publicDir: path.join(root, 'static-assets'), copyPublicDir: true }
    harness.writeOutput.mockRejectedValueOnce(new Error('simulated initial public write failure'))
    await expect(start()).rejects.toThrow('simulated initial public write failure')

    expect(harness.writeOutput).toHaveBeenCalledTimes(1)
    expect(harness.writeOutput.mock.calls[0]?.[2]).toEqual(initialPublicAssets)
    expect(commit).not.toHaveBeenCalled()
    const session = await start()
    const completeOutputs = harness.writeOutput.mock.calls.filter(([, output]) => output.some(item => item.fileName === 'app.js'))
    expect(completeOutputs).toHaveLength(2)
    expect(completeOutputs.map(([, , publicAssets]) => publicAssets)).toEqual([initialPublicAssets, initialPublicAssets])
    expect(completeOutputs[1]?.[1]).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.probe { color: red; }'),
    })
    expect(commit).toHaveBeenCalledTimes(1)

    harness.writeOutput.mockClear()
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(harness.writeOutput.mock.calls.some(([, output]) => output.some(item => item.fileName === 'app.js'))).toBe(true)
    expect(harness.writeOutput.mock.calls.every(([, , publicAssets]) => publicAssets === undefined)).toBe(true)
  })

  it('keeps the same output queue recoverable without consuming public assets before its first successful write', async () => {
    const readyGate = Promise.withResolvers<void>()
    harness.beforeInitialReady.mockImplementationOnce(() => readyGate.promise)
    harness.writeOutput.mockRejectedValueOnce(new Error('initial write failed before ready subscription'))
    const starting = expect(start()).rejects.toThrow('initial write failed before ready subscription')
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.writeOutput).toHaveBeenCalledTimes(1)

    // 引擎可在启动方收到失败前再次交付输出；队列恢复不应把首轮失败改成成功。
    harness.callbacks!.onOutput(appOutput())
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.writeOutput).toHaveBeenCalledTimes(2)
    expect(harness.writeOutput.mock.calls.map(([, , publicAssets]) => publicAssets)).toEqual([
      { publicDir: path.join(root, 'static-assets'), copyPublicDir: true },
      { publicDir: path.join(root, 'static-assets'), copyPublicDir: true },
    ])
    readyGate.resolve()
    await starting
  })

  it('uses initial snapshot routes and clears global-only styles when a refresh changes isolation', async () => {
    const session = await start()
    expect(writtenAssets()).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.probe { color: red; }'),
    })
    harness.writeOutput.mockClear()
    session.rebuild.mockResolvedValue(snapshot('blue', []))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: `${route}.wxss`, source: '' })
    expect(writtenAssets()).not.toContainEqual(expect.objectContaining({ fileName: 'app.wxss' }))
  })

  it('retries the complete asset diff after a failed refresh instead of adopting unwritten styles', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('simulated write failure'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' },
      { type: 'asset', fileName: `${route}.wxss`, source: expect.stringContaining('.probe { color: blue; }') },
    ]))
  })

  it('does not adopt a refresh superseded while waiting for the serial output queue', async () => {
    const session = await start(snapshot('red', []))
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => await blocked.promise)
    harness.callbacks!.onOutput([{ type: 'asset', fileName: 'pending.txt', source: 'pending' }])
    await vi.advanceTimersByTimeAsync(1)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(writtenAssets().filter(item => item.fileName === styleFile)).toEqual([
      { type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' },
    ])
    expect(writtenAssets()).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.probe { color: blue; }'),
    })
  })

  it('keeps full-build transport and snapshot state unchanged until the full output succeeds', async () => {
    const commit = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild')
    const session = await start()
    expect(commit).toHaveBeenCalledTimes(1)
    session.rebuild.mockResolvedValue(snapshot('blue', []))
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('simulated full write failure'))
    const outputReady = Promise.withResolvers<void>()
    harness.fullBuild.mockImplementationOnce(async () => {
      // 对应 ensureLatestBuildOutput 在异步输出回调完成后才返回的边界。
      await outputReady.promise
      harness.callbacks!.onOutput(appOutput())
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    outputReady.resolve()
    await vi.advanceTimersByTimeAsync(1)
    expect(commit).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(session.rebuild.mock.calls[1]?.[0]).toEqual([
      path.join(root, 'src/page.vue'),
      path.join(root, 'src/page.wxss'),
    ])
    expect(commit).toHaveBeenCalledTimes(2)
    expect(writtenAssets()).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' },
      { type: 'asset', fileName: `${route}.wxss`, source: '' },
    ]))
  })

  it('retains a full batch when the adapter finishes without delivering output', async () => {
    const session = await start()
    harness.writeOutput.mockClear()
    harness.fullBuild.mockResolvedValueOnce(undefined)
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)

    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(harness.writeOutput.mock.calls.some(([, output]) => output.some(item => item.fileName === 'app.js'))).toBe(true)
  })

  it('discards superseded full snapshots before writing and adopts the replacement metadata atomically', async () => {
    const commit = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild')
    const session = await start()
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => await blocked.promise)
    harness.callbacks!.onOutput([{ type: 'asset', fileName: 'pending.txt', source: 'pending' }])
    await vi.advanceTimersByTimeAsync(1)
    session.rebuild.mockResolvedValueOnce(snapshot('blue', [])).mockResolvedValue(snapshot('green'))
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(writtenAssets().filter(item => item.fileName === styleFile)).toEqual([
      { type: 'asset', fileName: styleFile, source: '.probe { color: green; }' },
    ])
    expect(writtenAssets().filter(item => item.fileName === `${route}.wxss`)).toEqual([
      { type: 'asset', fileName: `${route}.wxss`, source: expect.stringContaining('.probe { color: green; }') },
    ])
  })
})
