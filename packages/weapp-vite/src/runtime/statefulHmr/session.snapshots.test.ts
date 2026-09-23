import type { OutputBundle } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrInitialPublicAssets, StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrDevEngineUpdate } from './viteAdapter'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult } from '../../analyze/glassEasel'
import { refreshGlassEaselNativeScripts } from '../../analyze/glassEasel/nativeScripts'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { runStatefulHmrDev } from './session'
import { StatefulHmrTransport } from './transport'

interface AdapterCallbacks {
  onOutput: (output: StatefulHmrOutputFile[], source?: 'full' | 'additional') => Promise<void>
  onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as AdapterCallbacks | undefined,
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[], initialPublicAssets?: StatefulHmrInitialPublicAssets) => Promise<void>>(),
  fullBuild: vi.fn<() => Promise<void>>(),
  beforeInitialReady: vi.fn<() => Promise<void>>(),
  beforeFullPrepare: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: AdapterCallbacks) {
      harness.callbacks = { ...callbacks, onOutput: (output, source = 'full') => callbacks.onOutput(output, source) }
    }

    install() {}
    async registerBundleModules() { return 1 }
    async registerPatchModules() {}
    async markPayloadDelivered() {}
    async rebuild(prepare?: () => void | Promise<void>) {
      await harness.beforeFullPrepare()
      await prepare?.()
      await harness.fullBuild()
    }
  },
}))

const route = 'pages/shared/index'
const styleFile = `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`
const root = path.join(realpathSync(tmpdir()), 'stateful-session-snapshots')
const watchers: Array<{ close: () => Promise<void> }> = []
const temporaryDirectories: string[] = []

function appOutput(): StatefulHmrOutputFile[] {
  return [{ type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} }]
}

function snapshot(color: string, routes: string[] = [route]): StatefulHmrSnapshot {
  return {
    output: [{ type: 'asset', fileName: 'app.wxss', source: `.probe { color: ${color}; }` }],
    componentPageGlobalStyleRoutes: routes,
    glassEaselAnalysisByOwner: new Map(),
  }
}

function analyzedSnapshot(paired: boolean, selector = '.valid'): StatefulHmrSnapshot {
  // 分析器只读取配置与真实 runtime state；文件系统由现有 session harness 隔离。
  const producer = {
    runtimeState: createRuntimeState(),
    configService: { platform: 'weapp' },
  } as unknown as CompilerContext
  producer.runtimeState.glassEasel.silent = true
  const config = {
    type: 'asset' as const,
    fileName: 'app.json',
    source: JSON.stringify({
      glassEaselWebview: true,
      ...(paired ? { componentFramework: 'glass-easel' } : {}),
    }),
  }
  analyzeGlassEaselBundle(producer, {
    'app.json': config,
    'page.js': {
      type: 'chunk',
      fileName: 'page.js',
      facadeModuleId: path.join(root, 'src/page.js'),
      code: `wx.createSelectorQuery().select(${JSON.stringify(selector)}).exec()`,
    },
  } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
  const value = snapshot(paired ? 'blue' : 'red')
  return {
    ...value,
    output: [...value.output, config],
    glassEaselAnalysisByOwner: producer.runtimeState.glassEasel.analysisByOwner,
  }
}

async function start(initial = snapshot('red'), entryIds: string[] = [], inlineConfig: InlineConfig = {}) {
  const rebuild = vi.fn(async (_files: string[]) => snapshot('blue'))
  const changes = new Map<string, string>()
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      weappViteConfig: {},
      inlineConfig,
    },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: {
      collectAffectedEntries: () => new Set(),
      getPendingChanges: () => Array.from(changes, ([file, event]) => ({ file, event })),
    },
  } as unknown as MutableCompilerContext
  const events = createDevBuildWatcher()
  const watcher = await runStatefulHmrDev(ctx, { root }, vi.fn(async () => {}), { initial, entryIds, rebuild }, events)
  watchers.push(watcher)
  return {
    rebuild,
    ctx,
    events,
    changeProfile(reasons: string[]) {
      ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = reasons
    },
    sourceChange(file: string, event = 'update', reasons: string[] = []) {
      changes.set(file, event)
      ctx.onStatefulHmrSourceChange!(file, reasons)
    },
    patch: (reasons: string[]) => {
      ctx.onStatefulHmrSourceChange!(path.join(root, 'src/page.vue'), reasons)
      ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = []
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
    harness.beforeFullPrepare.mockReset().mockResolvedValue()
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

  it('applies configured build polling to the Vite source watcher', async () => {
    await start(snapshot('red'), [], { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } })
    expect(harness.createServer.mock.calls.at(-1)?.[0].server.watch).toMatchObject({ usePolling: true, interval: 50 })
  })

  it('rejects old-engine patches and retains successful assets until a metadata topology change replaces the engine', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/added-child.js')
    const session = await start(snapshot('red'), [page])
    expect(session.patch([])).toBe(true)
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    expect(session.patch([])).toBe(false)
    const currentStyle = writtenAssets().filter(item => item.fileName === `${styleFile}`).at(-1)
    expect(currentStyle?.source).toContain('color: red')
    expect(currentStyle?.source).not.toContain('color: blue')
  })

  afterEach(async () => {
    await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('delivers a native child component patch without rebuilding its parent page', async () => {
    const component = path.join(root, 'src/counter.js')
    const page = path.join(root, 'src/page.js')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    const session = await start(snapshot('red'), [component, page])
    const changedIds = [
      'src/counter.js',
      createSidecarSourceSpecifier(page, 'src/counter.js', 'using-component'),
    ]
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'Component({ methods: { increment() { return 2 } } });',
      filename: 'update.js',
      changedIds,
    })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(delta).toHaveBeenCalledWith(expect.stringContaining('increment'), changedIds)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps atomic child restoration as a patch when the watcher also reports parent directory metadata', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/child-restore-'))
    temporaryDirectories.push(directory)
    const component = path.join(directory, 'index.js')
    const page = path.join(root, 'src/page.js')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    const session = await start(snapshot('red'), [component, page])
    const patch = (step: number) => ({
      type: 'Patch' as const,
      code: `Component({ methods: { increment() { return ${step} } } });`,
      filename: 'update.js',
      changedIds: [component, createSidecarSourceSpecifier(page, component, 'using-component')],
    })
    await writeFile(component, 'Component({ step: 2 })')
    session.sourceChange(component)
    expect(harness.callbacks!.onPatch([component], patch(2))).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    const temporary = path.join(directory, '.atomic-save.tmp')
    await writeFile(temporary, 'Component({ step: 1 })')
    await rename(temporary, component)
    session.sourceChange(directory)
    session.sourceChange(component)
    expect(harness.callbacks!.onPatch([directory, component], patch(1))).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(delta).toHaveBeenCalledTimes(2)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('preserves real directory creation and deletion after a metadata-only update', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/child-topology-'))
    temporaryDirectories.push(directory)
    const session = await start()
    session.sourceChange(directory)
    harness.callbacks!.onPatch([directory], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).not.toHaveBeenCalled()

    session.sourceChange(directory, 'create')
    harness.callbacks!.onPatch([directory], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(session.rebuild).toHaveBeenLastCalledWith([directory])

    await rm(directory, { recursive: true })
    session.sourceChange(directory, 'delete')
    harness.callbacks!.onPatch([directory], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(session.rebuild).toHaveBeenLastCalledWith([directory])
  })

  it('keeps new sidecars and executable entry topology updates actionable after directory metadata', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/new-sidecar-'))
    temporaryDirectories.push(directory)
    const session = await start()
    const style = path.join(directory, 'index.wxss')
    await writeFile(style, '.new { color: red; }')
    session.sourceChange(directory)
    session.sourceChange(style, 'create')
    harness.callbacks!.onPatch([directory, style], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([style])

    session.rebuild.mockClear()
    const source = path.join(directory, 'index.js')
    await writeFile(source, 'Component({})')
    session.sourceChange(directory)
    session.sourceChange(source, 'create')
    harness.callbacks!.onPatch([directory, source], { type: 'FullReload', reason: 'new entry topology' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([source])
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
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

  it('keeps source classifications across unrelated profile writes and consumes only the delivered files', async () => {
    const component = path.join(root, 'src/component.vue')
    const other = path.join(root, 'src/other.vue')
    const session = await start(snapshot('red'), [component, other])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    session.sourceChange(other, 'update', ['entry-local-asset:1'])
    session.changeProfile(['entry-direct:1'])
    const patch = { type: 'Patch' as const, code: 'void 0', filename: 'update.js' }

    expect(harness.callbacks!.onPatch([component], patch)).toBe(false)
    expect(harness.callbacks!.onPatch([other], patch)).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([component, other])
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({
      fileName: `${route}.wxss`,
      source: expect.stringContaining('color: blue'),
    }))
  })

  it('uses the latest same-file event rather than an earlier style classification', async () => {
    const component = path.join(root, 'src/component.vue')
    const session = await start(snapshot('red'), [component])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    session.sourceChange(component, 'update', ['entry-direct:1'])
    session.changeProfile(['entry-style-only:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
    })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('consumes classifications for Noop batches without retaining them for a later update', async () => {
    const component = path.join(root, 'src/component.vue')
    const session = await start(snapshot('red'), [component])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
    session.changeProfile(['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
    })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps the source classification until a native patch arrives after its snapshot', async () => {
    const component = path.join(root, 'src/component.vue')
    const session = await start(snapshot('red'), [component])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([component])
    session.changeProfile(['entry-direct:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
      changedIds: [createSidecarSourceSpecifier(path.join(root, 'src/page.js'), component, 'using-component')],
    })).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps snapshot-owned component metadata intact when DevEngine delivers additional assets', async () => {
    const componentJson: StatefulHmrOutputFile = {
      type: 'asset',
      fileName: 'components/leaf/index.json',
      source: JSON.stringify({ component: true, options: { multipleSlots: true } }),
    }
    const initial = snapshot('red')
    initial.output.push(componentJson)
    const session = await start(initial)
    session.rebuild.mockResolvedValue(initial)
    const published = new Map(writtenAssets().map(asset => [asset.fileName, asset.source]))
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        if (item.type === 'asset') {
          published.set(item.fileName, item.source)
        }
      }
    })
    harness.callbacks!.onOutput([
      { type: 'asset', fileName: componentJson.fileName, source: JSON.stringify({ options: { multipleSlots: true } }) },
      { type: 'asset', fileName: 'assets/new.svg', source: '<svg />' },
    ], 'additional')
    await vi.advanceTimersByTimeAsync(1)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)

    expect(published.get(componentJson.fileName)).toBe(componentJson.source)
    expect(published.get('assets/new.svg')).toBe('<svg />')
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps an older native full output on the adopted snapshot while draining before the new batch', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    harness.beforeFullPrepare.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput(appOutput(), 'full')
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().filter(item => item.fileName === styleFile).map(item => item.source)).toEqual([
      '.probe { color: red; }',
      '.probe { color: blue; }',
    ])
  })

  it('does not acknowledge a full batch from additional chunks and replays its unpublished snapshot', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput([{ type: 'chunk', fileName: 'pages/index.js', code: 'Page({})', modules: {} }], 'additional')
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().some(item => item.fileName === styleFile)).toBe(false)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' })
  })

  it('waits for the actual full callback after additional assets before adopting the snapshot', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    const gate = Promise.withResolvers<void>()
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput([{ type: 'asset', fileName: 'extra.svg', source: '<svg/>' }], 'additional')
      await gate.promise
      await harness.callbacks!.onOutput(appOutput(), 'full')
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().some(item => item.fileName === styleFile)).toBe(false)
    gate.resolve()
    await vi.advanceTimersByTimeAsync(1)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' })
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
    void harness.callbacks!.onOutput([{ type: 'asset', fileName: 'pending.txt', source: 'pending' }], 'additional')
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
    void harness.callbacks!.onOutput([{ type: 'asset', fileName: 'pending.txt', source: 'pending' }], 'additional')
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

  it('never publishes fixed diagnostics from a refresh superseded during its write', async () => {
    const session = await start(analyzedSnapshot(false))
    // start() 的上下文已初始化，消费者只读取分析结果。
    const consumer = session.ctx as CompilerContext
    const reports: string[][] = []
    session.events.watcher.on('event', (event) => {
      if (event.code === 'END') {
        reports.push(createGlassEaselAnalyzeResult(consumer).diagnostics.map(item => item.code))
      }
    })
    session.rebuild.mockResolvedValueOnce(analyzedSnapshot(true)).mockResolvedValue(analyzedSnapshot(false))
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => blocked.promise)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics.map(item => item.code)).toEqual(['GE001'])
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(reports).toEqual([['GE001'], ['GE001']])
  })

  it('keeps a newer native script result when an older asset snapshot commits', async () => {
    const session = await start(analyzedSnapshot(true, '.1-old'))
    // 同一活动上下文同时消费 native script 与资产快照。
    const consumer = session.ctx as CompilerContext
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics.map(item => item.code)).toEqual(['GE005'])
    session.rebuild.mockResolvedValue(analyzedSnapshot(true, '.1-old'))
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => blocked.promise)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    refreshGlassEaselNativeScripts(consumer, [{
      file: 'page.js',
      modules: [{
        id: path.join(root, 'src/page.js'),
        code: 'wx.createSelectorQuery().select(\".valid\").exec()',
      }],
    }])
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics).toEqual([])
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics).toEqual([])
  })
})
