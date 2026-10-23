import type { IncomingMessage, ServerResponse } from 'node:http'
import type { OutputBundle } from 'rolldown'
import type { InlineConfig, ViteDevServer } from 'vite'
import type { HmrProfileJsonSample } from '../../analyze/hmr'
import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrInitialPublicAssets, StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrProfileHandoff } from './profile'
import type { StatefulHmrDevEngineBatch, StatefulHmrDevEngineUpdate } from './viteAdapter'
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockViteWatcher } from '../../../test/helpers/viteWatcher'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult } from '../../analyze/glassEasel'
import { refreshGlassEaselNativeScripts } from '../../analyze/glassEasel/nativeScripts'
import { createLogicalEntryId, createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { CompilerHmrResyncError, compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import * as compilerInputs from '../../plugins/utils/sourceSnapshot'
import * as realpaths from '../../utils/realpathScope'
import { beginWxmlDependencies } from '../../wxml/processing/dependencies'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { HmrRuntimeCapabilityError } from '../hmrRuntimeCapabilities'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { createStatefulHmrHostPlugins } from './hostPlugins'
import { StatefulHmrProfile } from './profile'
import { runStatefulHmrDev } from './session'
import { StatefulHmrTransport } from './transport'

interface AdapterCallbacks {
  onNativeError: (error: Error) => void
  onOutput: (output: StatefulHmrOutputFile[], source?: 'full' | 'additional') => Promise<void>
  onBatch: (batch: StatefulHmrDevEngineBatch) => void
  onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as AdapterCallbacks | undefined,
  nativeOutput: [] as StatefulHmrOutputFile[],
  initialOutput: true,
  nativeSettlement: vi.fn<() => Promise<void>>(),
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[], initialPublicAssets?: StatefulHmrInitialPublicAssets, removedAssets?: string[]) => Promise<void>>(),
  fullBuild: vi.fn<() => Promise<void>>(),
  beforeInitialReady: vi.fn<() => Promise<void>>(),
  beforeFullPrepare: vi.fn<() => Promise<void>>(),
  registerBundleModules: vi.fn<() => Promise<number>>(),
  registerPatchModules: vi.fn<(code: string) => Promise<void>>(),
  markPayloadDelivered: vi.fn<(filename: string) => Promise<void>>(),
  closeAdapter: vi.fn<() => Promise<void>>(),
  closeServer: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('../../plugins/asset/prune', () => ({ pruneOwnedAssetFiles: vi.fn(async () => {}) }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: AdapterCallbacks) {
      harness.callbacks = { ...callbacks, onOutput: (output, source = 'full') => callbacks.onOutput(output, source) }
    }

    install() {}
    async close() {
      await harness.closeAdapter()
    }

    async registerBundleModules() {
      return harness.registerBundleModules()
    }

    async registerPatchModules(code: string) {
      await harness.registerPatchModules(code)
    }

    async markPayloadDelivered(filename: string) {
      await harness.markPayloadDelivered(filename)
    }

    async waitForNativeUpdates() {}
    async whenSettled() {
      await harness.nativeSettlement()
    }

    async rebuild(prepare?: () => void | Promise<void>) {
      await harness.beforeFullPrepare()
      await prepare?.()
      await harness.fullBuild()
    }
  },
}))

const route = 'pages/shared/index'
const contentFile = 'snapshot-content.wxml'
const pageContentFile = 'pages/shared/snapshot-content.wxml'
const root = path.join(realpathSync(tmpdir()), 'stateful-session-snapshots')
const watchers: Array<{ close: () => Promise<void> }> = []
const temporaryDirectories: string[] = []

function appOutput(): StatefulHmrOutputFile[] {
  return [{ type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} }, ...harness.nativeOutput]
}

function snapshot(color: string, routes: string[] = [route]): StatefulHmrSnapshot {
  return {
    output: [
      { type: 'asset', fileName: contentFile, source: `<view data-color="${color}"></view>` },
      { type: 'asset', fileName: pageContentFile, source: routes.includes(route) ? `<view data-color="${color}"></view>` : '' },
    ],
    componentPageGlobalStyleRoutes: [],
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

async function start(initial = snapshot('red'), entryIds: string[] = [], inlineConfig: InlineConfig = {}, nativeSources = new Map<string, string>(), profile?: StatefulHmrProfileHandoff, onContext?: (ctx: MutableCompilerContext) => void) {
  const controls = vi.spyOn(StatefulHmrTransport.prototype, 'createControl')
  const rebuild = vi.fn(async (_files: string[], _sources?: ReadonlyMap<string, string | null>) => snapshot('blue'))
  const changes = new Map<string, string>()
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      multiPlatform: { enabled: false },
      weappViteConfig: { hmr: { profileJson: profile ? true : undefined } },
      inlineConfig,
    },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: {
      collectAffectedEntries: () => new Set(),
      recordChangedFile: (file: string, event: string) => changes.set(file, event),
      getPendingChanges: () => Array.from(changes, ([file, event]) => ({ file, event })),
    },
  } as unknown as MutableCompilerContext
  for (const [file, source] of nativeSources) {
    getCompilerHmrHost(ctx).captureNative(file, source)
  }
  onContext?.(ctx)
  const events = createDevBuildWatcher()
  const restart = vi.fn(async () => {})
  const classic = vi.fn(async () => {})
  const runtime = getHmrRuntimeSession(ctx)
  runtime.bindRequest(classic)
  const watcher = await runStatefulHmrDev(ctx, { root }, restart, { initial, entryIds, rebuild, profile }, events)
  watchers.push(watcher)
  const plugins = harness.createServer.mock.calls.at(-1)![0].plugins as Array<{ name: string, api?: { whenSettled: () => Promise<void> } }>
  const whenSettled = plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!.api!.whenSettled
  const transport = controls.mock.contexts.at(-1) as StatefulHmrTransport
  const server = await harness.createServer.mock.results.at(-1)!.value as ViteDevServer
  const report = vi.mocked(server.middlewares.use).mock.calls[0]![1] as (request: IncomingMessage, response: ServerResponse) => Promise<void>
  const full = async () => {
    // 客户端重同步仍使用同一 stateful 引擎；DevEngine FullReload 已属于 classic 能力边界。
    const request = Object.assign(Readable.from([JSON.stringify({ ...transport.createControl(), action: 'rebuild', sessionId: 'snapshot-client', version: 0 })]), { method: 'POST' })
    const response = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 }
    await report(request as IncomingMessage, response as unknown as ServerResponse)
    expect(response.statusCode).toBe(202)
  }
  return {
    rebuild,
    restart,
    classic,
    runtime,
    close: () => watcher.close(),
    ctx,
    watcher,
    events,
    whenSettled,
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
    full,
  }
}

function writtenAssets() {
  return harness.writeOutput.mock.calls.flatMap(([, output]) => output).filter(item => item.type === 'asset')
}

function nativeTemplateSourceFile(identity: 'native' | 'windows-canonical') {
  if (identity === 'native') {
    return path.join(root, 'src/native.vue')
  }
  const file = 'C:/workspace/PROJEC~1/src/native.vue'
  const canonical = 'C:/workspace/project-name/src/native.vue'
  const resolve = realpaths.resolveRealpath
  vi.spyOn(realpaths, 'resolveRealpath').mockImplementation(id => id === file || id === canonical
    ? canonical.replaceAll('/', '\\')
    : resolve(id))
  return file
}

describe('stateful snapshot output transactions', () => {
  it.each(['syntax', 'read'] as const)('reports a React %s failure from the synchronous source listener and accepts the next valid save', async (kind) => {
    const file = path.join(root, 'src/shared/react-view.tsx')
    const readFailure = new Error('React source is unreadable')
    const read = vi.spyOn(compilerInputs, 'readCompilerInputSync')
    if (kind === 'syntax') {
      read.mockReturnValue('export function View() { return <view>')
    }
    else {
      read.mockImplementation(() => {
        throw readFailure
      })
    }
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig!.react = true
    })
    const events = vi.fn()
    session.events.watcher.on('event', events)
    harness.writeOutput.mockClear()

    // Tailwind 直接同步通知，不经过 core watchChange 的 Promise 错误边界。
    const notify = () => session.ctx.onStatefulHmrSourceChange!(file, ['tailwind-content:1'])
    expect(notify).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    const failures = events.mock.calls.map(([event]) => event).filter(event => event.code === 'ERROR')
    expect(failures).toHaveLength(1)
    const failure = failures[0]!.error
    if (kind === 'syntax') {
      expect(failure).toBeInstanceOf(SyntaxError)
    }
    else {
      expect(failure).toBe(readFailure)
    }
    const server = await harness.createServer.mock.results.at(-1)!.value as ViteDevServer
    expect(server.config.logger.error).toHaveBeenCalledWith('[weapp-vite] React HMR capability analysis failed', { error: failure })
    expect(session.runtime.phase).toBe('stateful')
    expect(session.runtime.fallback).toBeUndefined()
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.restart).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()

    read.mockReturnValue('export const View = () => <view>recovered</view>')
    expect(notify).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback).toMatchObject({ code: 'patch-shape', files: [file] })
    expect(session.runtime.fallback?.message).toContain('dynamic 模板')
    expect(events.mock.calls.map(([event]) => event).filter(event => event.code === 'ERROR')).toEqual(failures)
  })

  it('classifies a deleted non-entry React template as topology without reading the removed source', async () => {
    const file = path.join(root, 'src/shared/removed-view.tsx')
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig!.react = { renderMode: 'dynamic' }
    })
    expect(() => session.sourceChange(file, 'delete')).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback).toMatchObject({ code: 'entry-topology', files: [file] })
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.restart).not.toHaveBeenCalled()
  })

  it.each([false, true])('admits frozen compiled template registrations before any asset or delta publication (changed=%s)', async (changed) => {
    const owner = path.join(root, 'src/page.vue')
    const initial = {
      ...snapshot('red'),
      entryIds: [owner],
      templateRegistrationSignatures: new Map([[owner, 'registered-template']]),
    }
    const session = await start(initial, [owner])
    const server = await harness.createServer.mock.results.at(-1)!.value as ViteDevServer
    const events = vi.fn()
    session.events.watcher.on('event', events)
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    harness.writeOutput.mockClear()
    session.rebuild.mockResolvedValueOnce({
      ...snapshot('blue'),
      entryIds: [owner],
      templateRegistrationSignatures: new Map([[owner, changed ? 'new-template-registration' : 'registered-template']]),
    })
    expect(session.patch(['entry-mixed-asset:1'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(server.config.logger.error).not.toHaveBeenCalled()
    expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR' }))
    if (changed) {
      expect(session.classic).toHaveBeenCalledOnce()
      expect(session.runtime.fallback?.code).toBe('native-registration')
      expect(harness.writeOutput).not.toHaveBeenCalled()
      expect(delta).not.toHaveBeenCalled()
    }
    else {
      expect(session.classic).not.toHaveBeenCalled()
      expect(harness.writeOutput).toHaveBeenCalled()
      expect(delta).toHaveBeenCalledOnce()
    }
  })

  function compiledStylesheetSnapshot(color: string): StatefulHmrSnapshot {
    return {
      output: [{ type: 'asset', fileName: 'app.wxss', source: `.stylesheet { color: ${color}; }` }],
      componentPageGlobalStyleRoutes: [],
      glassEaselAnalysisByOwner: new Map(),
    }
  }

  const compilerStyleReasonOrders = [
    { label: 'direct', reasons: ['entry-direct:1'] },
    { label: 'content', reasons: ['tailwind-content:1'] },
    { label: 'direct then content', reasons: ['entry-direct:1', 'tailwind-content:1'] },
    { label: 'content then direct', reasons: ['tailwind-content:1', 'entry-direct:1'] },
  ]

  it.each(compilerStyleReasonOrders)('keeps unchanged provider CSS stateful after a script-only save ($label)', async ({ reasons }) => {
    const file = path.join(root, 'src/page.vue')
    const original = '<script setup>let count = 0; function increment() { count += 1 }</script><template><view /></template>'
    const changed = original.replace('count += 1', 'count += 2')
    const session = await start(compiledStylesheetSnapshot('red'), [file], {}, new Map([[file, original]]))
    await session.whenSettled()
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({
      assets: [{ fileName: 'app.wxss', code: '.stylesheet { color: red; }' }],
    }))
    host.register('stylesheet-provider', prepare)
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    harness.writeOutput.mockClear()
    host.captureNative(file, changed)
    for (const reason of reasons) {
      session.sourceChange(file, 'update', [reason])
    }
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()

    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]?.[0].sources.get(file)).toBe(changed)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).toHaveBeenCalledOnce()
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.runtime.phase).toBe('stateful')
    expect(session.runtime.fallback).toBeUndefined()
  })

  it.each(compilerStyleReasonOrders)('hands changed provider CSS from a script class literal to classic ($label)', async ({ reasons }) => {
    const file = path.join(root, 'src/page.vue')
    const original = '<script setup>const utility = "w-[37px]"</script><template><view /></template>'
    const changed = original.replace('w-[37px]', 'w-[53px]')
    const initial: StatefulHmrSnapshot = {
      output: [{ type: 'asset', fileName: 'app.wxss', source: '.utility { width: 37px; }' }],
      componentPageGlobalStyleRoutes: [],
      glassEaselAnalysisByOwner: new Map(),
    }
    const session = await start(initial, [file], {}, new Map([[file, original]]))
    await session.whenSettled()
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({
      assets: [{ fileName: 'app.wxss', code: '.utility { width: 53px; }' }],
    }))
    host.register('stylesheet-provider', prepare)
    session.classic.mockImplementation(async () => {
      await session.close()
      session.runtime.markClassic()
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockResolvedValue()
    harness.writeOutput.mockClear()
    host.captureNative(file, changed)
    for (const reason of reasons) {
      session.sourceChange(file, 'update', [reason])
    }
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await expect(session.runtime.whenSettled()).resolves.toBeUndefined()

    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]?.[0].sources.get(file)).toBe(changed)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
    expect(harness.registerPatchModules).not.toHaveBeenCalled()
    expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.phase).toBe('classic')
    expect(session.runtime.fallback).toMatchObject({
      code: 'stylesheet-output',
      files: [`${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`],
    })
  })

  it.each(['refresh', 'mixed', 'full', 'additional', 'compiler-assets'] as const)('hands changed compiled styles to classic before any %s write, delta or acknowledgement', async (mode) => {
    const session = await start(compiledStylesheetSnapshot('red'))
    await session.whenSettled()
    session.classic.mockImplementation(async () => {
      await session.close()
      session.runtime.markClassic()
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockResolvedValue()
    const full = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild').mockClear()
    const events = vi.fn()
    session.events.watcher.on('event', events)
    harness.writeOutput.mockClear()
    session.rebuild.mockResolvedValue(compiledStylesheetSnapshot('blue'))
    if (mode === 'additional') {
      await expect(harness.callbacks!.onOutput([
        { type: 'asset', fileName: 'pages/new/index.wxss', source: '.stylesheet { color: blue; }' },
      ], 'additional')).rejects.toMatchObject({ fallback: { code: 'stylesheet-output' } })
    }
    else if (mode === 'compiler-assets') {
      getCompilerHmrHost(session.ctx).register('stylesheet-provider', async () => ({
        assets: [{ fileName: `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`, code: '.stylesheet { color: blue; }' }],
      }))
      expect(session.patch(['tailwind-content:1'])).toBe(true)
    }
    else if (mode === 'mixed') {
      expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    }
    else {
      await session[mode]()
    }
    await vi.advanceTimersByTimeAsync(100)
    await expect(session.runtime.whenSettled()).resolves.toBeUndefined()
    expect(session.runtime.phase).toBe('classic')
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback?.code).toBe('stylesheet-output')
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
    expect(full).not.toHaveBeenCalled()
    expect(harness.registerPatchModules).not.toHaveBeenCalled()
    expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
    expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR' }))
    expect(harness.callbacks!.onPatch([path.join(root, 'src/page.js')], { type: 'Patch', code: 'stale()', filename: 'stale.js' })).toBe(false)
    await harness.callbacks!.onOutput([{ type: 'asset', fileName: 'stale.txt', source: 'stale' }], 'additional')
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
  })

  it('hands an explicitly removed compiled stylesheet to classic before deleting any asset', async () => {
    const initial = compiledStylesheetSnapshot('red')
    initial.output.push({ type: 'asset', fileName: 'retired.wxss', source: '.retired {}' })
    const session = await start(initial)
    session.classic.mockImplementation(async () => {
      await session.close()
      session.runtime.markClassic()
    })
    session.rebuild.mockResolvedValue(compiledStylesheetSnapshot('red'))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await expect(session.runtime.whenSettled()).resolves.toBeUndefined()
    expect(session.runtime.phase).toBe('classic')
    expect(session.runtime.fallback).toMatchObject({ code: 'stylesheet-output', files: ['retired.wxss'] })
    expect(session.classic).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it('keeps a real classic handoff rejected when closing the old adapter fails', async () => {
    const session = await start(compiledStylesheetSnapshot('red'))
    const cleanup = new Error('retiring adapter cleanup failed')
    harness.closeAdapter.mockRejectedValueOnce(cleanup)
    session.classic.mockImplementation(async () => {
      await session.close()
      session.runtime.markClassic()
    })
    session.rebuild.mockResolvedValue(compiledStylesheetSnapshot('blue'))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)

    await expect(session.runtime.whenSettled()).rejects.toBe(cleanup)
    expect(session.runtime.phase).toBe('switching')
    expect(session.runtime.fallback?.code).toBe('stylesheet-output')
    expect(session.classic).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    await expect(session.close()).rejects.toBe(cleanup)
    // 本用例已经断言并接管了不可重复成功的 close，公共清理不得再次把预期拒绝当成套件失败。
    watchers.splice(watchers.indexOf(session.watcher), 1)
  })

  it('keeps preparation cleanup failure alongside the capability that initiated a real classic handoff', async () => {
    const session = await start(compiledStylesheetSnapshot('red'))
    const cleanup = new Error('retiring preparation cleanup failed')
    getCompilerHmrHost(session.ctx).register('retiring-provider', async () => ({ dispose: () => {
      throw cleanup
    } }))
    session.classic.mockImplementation(async () => {
      await session.close()
      session.runtime.markClassic()
    })
    session.rebuild.mockResolvedValue(compiledStylesheetSnapshot('blue'))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)

    const combined = {
      cause: expect.objectContaining({ fallback: expect.objectContaining({ code: 'stylesheet-output' }) }),
      errors: [expect.objectContaining({ fallback: expect.objectContaining({ code: 'stylesheet-output' }) }), cleanup],
    }
    await expect(session.runtime.whenSettled()).rejects.toMatchObject(combined)
    expect(session.runtime.phase).toBe('switching')
    expect(session.classic).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    await expect(session.close()).rejects.toMatchObject(combined)
    watchers.splice(watchers.indexOf(session.watcher), 1)
  })

  it.each([
    { shutdown: 'classic', kind: 'io' },
    { shutdown: 'classic', kind: 'capability' },
    { shutdown: 'classic', kind: 'aggregate' },
    { shutdown: 'close', kind: 'io' },
    { shutdown: 'close', kind: 'capability' },
    { shutdown: 'close', kind: 'aggregate' },
  ] as const)('preserves an in-flight $kind output rejection during $shutdown retirement', async ({ shutdown, kind }) => {
    const session = await start()
    const entered = Promise.withResolvers<void>()
    const pending = Promise.withResolvers<void>()
    const io = new Error('retiring output write failed')
    const capability = new HmrRuntimeCapabilityError({ code: 'stylesheet-output', message: 'unrelated retiring capability failure' })
    const failure = kind === 'io' ? io : kind === 'capability' ? capability : new AggregateError([capability, io], 'retiring output and cleanup failed', { cause: capability })
    harness.writeOutput.mockClear().mockImplementationOnce(async () => {
      entered.resolve()
      await pending.promise
    })
    const publication = expect(harness.callbacks!.onOutput([
      { type: 'asset', fileName: 'pending.txt', source: 'pending' },
    ], 'additional')).rejects.toBe(failure)
    await entered.promise

    let retired: Promise<void>
    if (shutdown === 'classic') {
      session.classic.mockImplementation(async () => {
        await session.close()
        session.runtime.markClassic()
      })
      session.sourceChange(path.join(root, 'src/app.json'))
      expect(session.runtime.phase).toBe('switching')
      expect(session.runtime.fallback?.code).toBe('config-json')
      retired = session.runtime.whenSettled()
    }
    else {
      retired = session.close()
    }
    const retirement = expect(retired).rejects.toBe(failure)
    pending.reject(failure)
    await publication
    await retirement
    await expect(session.close()).rejects.toBe(failure)
    if (shutdown === 'classic') {
      expect(session.classic).toHaveBeenCalledOnce()
      expect(session.runtime.phase).toBe('switching')
      expect(session.runtime.fallback?.code).toBe('config-json')
    }
    else {
      expect(session.classic).not.toHaveBeenCalled()
    }
    // 本用例接管了预期失败的关闭结果，公共清理不能将其重复记为套件失败。
    watchers.splice(watchers.indexOf(session.watcher), 1)
  })

  it('publishes a compiler patch when its regenerated stylesheet bytes remain unchanged', async () => {
    const session = await start(compiledStylesheetSnapshot('red'))
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    getCompilerHmrHost(session.ctx).register('stylesheet-provider', async () => ({
      assets: [{ fileName: `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`, code: '.stylesheet { color: red; }' }],
    }))
    harness.writeOutput.mockClear()
    expect(session.patch(['tailwind-content:1'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(session.classic).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.registerPatchModules).toHaveBeenCalledExactlyOnceWith('void 0')
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
  })

  it('keeps settlement pending through a debounced refresh and its final output write', async () => {
    const session = await start()
    const rebuilt = Promise.withResolvers<StatefulHmrSnapshot>()
    const published = Promise.withResolvers<void>()
    session.rebuild.mockImplementationOnce(() => rebuilt.promise)
    harness.writeOutput.mockClear().mockImplementationOnce(() => published.promise)
    session.refresh()
    let settled = false
    const waiting = session.whenSettled().then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(40)
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(settled).toBe(false)
    rebuilt.resolve(snapshot('blue'))
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.writeOutput).toHaveBeenCalledOnce()
    expect(settled).toBe(false)
    published.resolve()
    await waiting
    expect(settled).toBe(true)
  })

  it('rejects failed publication settlement and accepts a later successful refresh', async () => {
    const session = await start()
    const server = await harness.createServer.mock.results.at(-1)!.value as ViteDevServer
    const events = vi.fn()
    session.events.watcher.on('event', events)
    const error = new Error('snapshot output publication failed')
    harness.writeOutput.mockRejectedValueOnce(error)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR', error }))
    expect(server.config.logger.error).toHaveBeenCalledWith(expect.stringContaining('[weapp-vite] stateful HMR output failed:'))
    expect(session.classic).not.toHaveBeenCalled()
    session.refresh()
    const recovered = session.whenSettled()
    await vi.advanceTimersByTimeAsync(40)
    await expect(recovered).resolves.toBeUndefined()
  })

  it('rejects a pending settlement on close and releases the host API binding', async () => {
    const session = await start()
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toThrow(/closed|not active/)
    await session.close()
    await rejected
    await expect(session.whenSettled()).rejects.toThrow('not active')
  })

  it('rejects old-engine settlement when a topology change requests classic', async () => {
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page])
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toThrow('closed or restarted before settlement')
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    expect(session.restart).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback?.code).toBe('entry-topology')
  })

  it('does not let an old session release a newer host settlement binding', async () => {
    const controller = createStatefulHmrHostPlugins({} as CompilerContext)
    const plugin = controller.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!
    const settle = plugin.api.whenSettled as () => Promise<void>
    const old = vi.fn(async () => {})
    const replacement = vi.fn(async () => {})
    const releaseOld = controller.bindSettlement(old)
    const releaseReplacement = controller.bindSettlement(replacement)
    releaseOld()
    await settle()
    expect(old).not.toHaveBeenCalled()
    expect(replacement).toHaveBeenCalledOnce()
    releaseReplacement()
    await expect(settle()).rejects.toThrow('not active')
  })

  it('keeps the old host unsettled while its asynchronous classic handoff is in progress', async () => {
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page])
    const restarted = Promise.withResolvers<void>()
    session.classic.mockImplementationOnce(() => restarted.promise)
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    session.refresh()
    await vi.advanceTimersByTimeAsync(140)
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.restart).not.toHaveBeenCalled()
    await expect(session.whenSettled()).rejects.toThrow('closed or restarted before settlement')
    restarted.resolve()
    await session.close()
  })

  it('ignores source updates after a topology classic handoff has started', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/child.js')
    const session = await start(snapshot('red'), [page])
    const restarted = Promise.withResolvers<void>()
    session.classic.mockImplementationOnce(() => restarted.promise)
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
    session.refresh()
    await vi.advanceTimersByTimeAsync(140)
    expect(session.classic).toHaveBeenCalledOnce()

    // classic 宿主读取最新输入，退休引擎不能再开启第二轮构建。
    session.sourceChange(path.join(root, 'src/app.json'), 'update', ['entry-graph-changed'])
    await vi.advanceTimersByTimeAsync(200)

    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    restarted.resolve()
    await session.close()
  })

  it.each(['initial', 'native'] as const)('interrupts settlement on close while %s engine work remains pending', async (pending) => {
    harness.initialOutput = pending !== 'initial'
    const session = await start()
    const native = Promise.withResolvers<void>()
    if (pending === 'native') {
      harness.nativeSettlement.mockImplementationOnce(() => native.promise)
    }
    const rejected = expect(session.whenSettled()).rejects.toThrow('closed or restarted before settlement')
    await vi.advanceTimersByTimeAsync(0)
    await session.close()
    await rejected
    native.resolve()
  })

  it('retires a topology snapshot before later source updates can publish it', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/child.js')
    const session = await start(snapshot('red'), [page])
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(session.classic).toHaveBeenCalledOnce()
    session.sourceChange(path.join(root, 'src/child.js'))
    await vi.advanceTimersByTimeAsync(200)
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.restart).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it('closes a retired topology engine once without another handoff or stale publication', async () => {
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page])
    session.rebuild.mockResolvedValue({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    await Promise.all([session.close(), session.close()])
    await vi.advanceTimersByTimeAsync(200)
    expect(session.restart).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(harness.closeAdapter).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it.each([
    ['pages/shared/index.wxml', '<view>updated</view>'],
    ['pages/shared/index.wxss', '.native-updated { color: blue; }'],
  ])('admits native %s output by compiled capability when a compiler also scans that source', async (fileName, source) => {
    const session = await start()
    const file = path.join(root, 'src', fileName)
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({}))
    compiler.seed(file, 'before')
    compiler.capture(file, source)
    session.rebuild.mockResolvedValueOnce({
      ...snapshot('blue'),
      output: [...snapshot('blue').output, { type: 'asset', fileName, source }],
    })
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([path.relative(root, file)], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(session.rebuild).toHaveBeenCalledWith([file], expect.any(Map))
    if (fileName.endsWith('.wxss')) {
      expect(session.runtime.fallback).toMatchObject({ code: 'stylesheet-output', files: [fileName] })
      expect(session.classic).toHaveBeenCalledOnce()
      expect(writtenAssets().filter(asset => asset.fileName === fileName)).toEqual([])
    }
    else {
      expect(writtenAssets().findLast(asset => asset.fileName === fileName)?.source).toContain(source)
      expect(session.classic).not.toHaveBeenCalled()
    }
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it.each(['transform', 'validate'] as const)('keeps registered %s JSON dependencies recoverable without converting validation errors to classic', async (stage) => {
    const file = path.join(root, `${stage}-rules.json`)
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      const dependencies = beginWxmlDependencies(ctx as CompilerContext, 'main', false, stage)
      dependencies.template(`${route}.wxml`)(file)
      dependencies.commit()
    })
    const events = vi.fn()
    session.events.watcher.on('event', events)
    const failure = new SyntaxError(`${stage} rule rejected`)
    session.rebuild.mockRejectedValueOnce(failure)
    harness.writeOutput.mockClear()

    session.sourceChange(file, 'update', ['wxml-transform-dependency:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(false)
    const rejected = expect(session.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR', error: failure }))
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.runtime.fallback).toBeUndefined()
    expect(harness.writeOutput).not.toHaveBeenCalled()

    session.sourceChange(file)
    const recovered = session.whenSettled()
    await vi.advanceTimersByTimeAsync(100)
    await expect(recovered).resolves.toBeUndefined()
    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(writtenAssets().findLast(asset => asset.fileName === contentFile)?.source).toContain('blue')
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
    expect(session.classic).not.toHaveBeenCalled()
  })

  it.each([false, true])('hands native app JSON metadata to classic even when it is also a template input (%s)', async (templateDependency) => {
    const file = path.join(root, 'src/app.json')
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      if (templateDependency) {
        const dependencies = beginWxmlDependencies(ctx as CompilerContext, 'main', false)
        dependencies.template(`${route}.wxml`)(file)
        dependencies.commit()
      }
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    harness.writeOutput.mockClear()
    session.sourceChange(file, 'update', ['entry-json-only:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback).toMatchObject({ code: 'config-json', files: [file] })
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
  })

  it.each([
    { contentFirst: false, templateDependency: false },
    { contentFirst: true, templateDependency: false },
    { contentFirst: false, templateDependency: true },
    { contentFirst: true, templateDependency: true },
  ])('preserves native JSON sidecar admission across compiler scan notifications ($contentFirst, $templateDependency)', async ({ contentFirst, templateDependency }) => {
    const page = path.join(root, 'src/page.js')
    const file = path.join(root, 'src/page.json')
    const template = path.join(root, 'src/page.wxml')
    const style = path.join(root, 'src/imported.wxss')
    const script = path.join(root, 'src/imported.js')
    const session = await start(snapshot('red'), [page], {}, new Map(), undefined, (ctx) => {
      if (templateDependency) {
        const dependencies = beginWxmlDependencies(ctx as CompilerContext, 'main', false)
        dependencies.template(`${route}.wxml`)(file)
        dependencies.commit()
      }
    })
    const compiler = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async () => ({}))
    compiler.register('content-scanner', prepare)
    compiler.seed(file, '{}')
    compiler.captureNative(file, '{"usingComponents":{"optional":"./optional"}}')
    expect(compiler.ownsDependency(file)).toBe(true)
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    harness.writeOutput.mockClear()

    // core 的真实原生 JSON producer 与 Tailwind 扫描通知分别到达，不使用 SFC 配置原因代替。
    const metadata = ['json-sidecar:2']
    const content = ['tailwind-content:1']
    for (const reasons of contentFirst ? [content, metadata] : [metadata, content]) {
      session.sourceChange(file, 'update', reasons)
    }
    // 旧样式脚本可能与当前模板、JSON 同批交付，但不能抢走已观察的配置回退原因。
    harness.callbacks!.onBatch({
      changedFiles: [template, file, style, script],
      updates: [{ clientId: 'weapp-vite-stateful-hmr', update: { type: 'Patch', code: 'void 0', filename: 'update.js' } }],
    })
    expect(session.runtime.fallback).toMatchObject({ code: 'config-json', files: [file] })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.classic).toHaveBeenCalledOnce()
    expect(prepare).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
  })

  it.each(['transform', 'validate'] as const)('keeps compiler-scanned %s JSON dependencies on the snapshot path', async (stage) => {
    const file = path.join(root, `${stage}-rules.json`)
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      const dependencies = beginWxmlDependencies(ctx as CompilerContext, 'main', false, stage)
      dependencies.template(`${route}.wxml`)(file)
      dependencies.commit()
      getCompilerHmrHost(ctx as CompilerContext).seed(file, '{"valid":true}')
    })
    harness.writeOutput.mockClear()
    session.sourceChange(file, 'update', ['wxml-transform-dependency:1'])
    const settled = session.whenSettled()
    await vi.advanceTimersByTimeAsync(100)
    await expect(settled).resolves.toBeUndefined()
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.runtime.fallback).toBeUndefined()
    expect(writtenAssets().findLast(asset => asset.fileName === contentFile)?.source).toContain('blue')
  })

  it('hands a safe script patch to classic when a registered compiler provider lacks HMR support', async () => {
    const session = await start(snapshot('red'))
    getCompilerHmrHost(session.ctx).register('legacy-provider', undefined)
    harness.writeOutput.mockClear()
    expect(session.patch([])).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback?.code).toBe('compiler-provider')
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it('hands JSON metadata to classic before a compiler can publish it on the old engine', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/child.js')
    const session = await start(snapshot('red'), [page])
    const file = path.join(root, 'src/page.json')
    const compiler = getCompilerHmrHost(session.ctx)
    const dispose = vi.fn()
    compiler.register('scan-only-provider', async () => ({ dispose }))
    compiler.seed(file, '{}')
    compiler.capture(file, '{"usingComponents":{"child":"./child"}}')
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
    harness.writeOutput.mockClear()
    session.sourceChange(file, 'update', ['entry-json-only:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(dispose).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback).toMatchObject({ code: 'config-json', files: [file] })
    expect(session.patch([])).toBe(false)
  })

  it('retires assets removed by a compiler-owned native snapshot batch', async () => {
    const removed = { type: 'asset' as const, fileName: 'resources/deleted.txt', source: 'old' }
    const initial = snapshot('red', [])
    initial.output.push(removed)
    const session = await start(initial)
    const file = path.join(root, 'src/page.wxml')
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({}))
    compiler.seed(file, '<view>before</view>')
    compiler.capture(file, '<view>after</view>')
    session.rebuild.mockResolvedValue(snapshot('blue', []))
    harness.writeOutput.mockClear()
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])).toContain(removed.fileName)
  })

  it('restores unchanged bytes after a compiler batch partially writes and fails', async () => {
    const initial = snapshot('red', [])
    const session = await start(initial)
    const file = path.join(root, 'src/page.wxml')
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({}))
    compiler.seed(file, '<view>before</view>')
    compiler.capture(file, '<view>after</view>')
    const partial = snapshot('blue', [])
    partial.output.push({ type: 'asset', fileName: 'resources/partial.txt', source: 'partial' })
    session.rebuild.mockResolvedValueOnce(partial).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('partial batch write'))
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    harness.writeOutput.mockClear()
    // 新源事件以完整重同步恢复；不得用失败前的字节快照省略真实写回。
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="red"></view>' }))
    expect(harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])).toContain('resources/partial.txt')
  })

  it('issue #1081: commits final compiler assets before publishing a patch and only acknowledges scripts after execution', async () => {
    const applied = Promise.withResolvers<void>()
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await applied.promise
      await delivered?.()
    })
    const session = await start()
    const ended = vi.fn()
    session.events.watcher.on('event', ended)
    ended.mockClear()
    harness.writeOutput.mockClear()
    const commit = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => commit.promise)
    try {
      expect(session.patch(['compiler-content:tailwind'])).toBe(true)
      await vi.advanceTimersByTimeAsync(50)
      expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
      expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: pageContentFile, source: expect.stringContaining('data-color="blue"') }))
      expect(delta).not.toHaveBeenCalled()
      expect(harness.registerPatchModules).not.toHaveBeenCalled()
      expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
      expect(ended).not.toHaveBeenCalled()

      commit.resolve()
      await vi.advanceTimersByTimeAsync(1)
      expect(delta).toHaveBeenCalledOnce()
      expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
      expect(ended).not.toHaveBeenCalled()
      const writesBeforeAcknowledgement = harness.writeOutput.mock.calls.length
      applied.resolve()
      await vi.advanceTimersByTimeAsync(1)
      expect(harness.registerPatchModules).toHaveBeenCalledExactlyOnceWith('void 0')
      expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
      expect(harness.writeOutput).toHaveBeenCalledTimes(writesBeforeAcknowledgement)
      expect(ended).toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
    }
    finally {
      commit.resolve()
      applied.resolve()
    }
  })

  it('issue #1081: does not publish or acknowledge a patch when final assets fail and restores the store before a later batch', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const initial = snapshot('red')
    const session = await start(initial)
    const failure = new Error('compiler asset write failed')
    session.rebuild.mockResolvedValueOnce(snapshot('blue')).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(failure)
    expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(delta).not.toHaveBeenCalled()
    expect(harness.registerPatchModules).not.toHaveBeenCalled()
    expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
    await expect(session.whenSettled()).rejects.toBe(failure)

    harness.writeOutput.mockClear()
    expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="red"></view>' }))

    session.rebuild.mockResolvedValue(snapshot('green'))
    expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="green"></view>' }))
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.registerPatchModules).toHaveBeenCalledOnce()
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
  })

  it('issue #1081: shares one final asset snapshot across ordered patches and commits the next batch after acknowledgement', async () => {
    const applied = Promise.withResolvers<void>()
    const order: string[] = []
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      order.push('publish')
      if (delta.mock.calls.length === 1) {
        await applied.promise
      }
      await delivered?.()
    })
    const session = await start()
    session.rebuild.mockResolvedValueOnce(snapshot('blue')).mockResolvedValueOnce(snapshot('green'))
    harness.writeOutput.mockClear().mockImplementation(async (_outDir, output) => {
      const content = output.find(item => item.fileName === contentFile)
      if (content?.type === 'asset') {
        order.push(`write:${content.source}`)
      }
    })
    harness.registerPatchModules.mockImplementation(async (code) => {
      order.push(`register:${code}`)
    })
    harness.markPayloadDelivered.mockImplementation(async (filename) => {
      order.push(`mark:${filename}`)
    })
    const file = path.join(root, 'src/page.vue')
    try {
      session.sourceChange(file, 'update', ['compiler-content:tailwind'])
      harness.callbacks!.onBatch({
        changedFiles: [file],
        updates: [
          { clientId: 'first', update: { type: 'Patch', code: 'order.push("first")', filename: 'first.js', changedIds: ['first-module'] } },
          { clientId: 'second', update: { type: 'Patch', code: 'order.push("second")', filename: 'second.js', changedIds: ['first-module', 'second-module'] } },
        ],
      })
      await vi.advanceTimersByTimeAsync(50)
      expect(session.rebuild).toHaveBeenCalledOnce()
      expect(delta).toHaveBeenCalledOnce()
      expect(harness.writeOutput).toHaveBeenCalledOnce()
      expect(delta.mock.calls[0]![1]).toEqual(['first-module', 'second-module'])
      const executed: string[] = []
      runInNewContext(delta.mock.calls[0]![0], { order: executed })
      expect(executed).toEqual(['first', 'second'])
      expect(order).toEqual(['write:<view data-color="blue"></view>', 'publish'])

      expect(session.patch(['compiler-content:tailwind'])).toBe(true)
      await vi.advanceTimersByTimeAsync(50)
      expect(session.rebuild).toHaveBeenCalledTimes(2)
      expect(delta).toHaveBeenCalledOnce()
      expect(harness.writeOutput).toHaveBeenCalledOnce()
      expect(harness.markPayloadDelivered).not.toHaveBeenCalled()

      applied.resolve()
      await vi.advanceTimersByTimeAsync(1)
      await session.whenSettled()
      expect(delta).toHaveBeenCalledTimes(2)
      expect(harness.writeOutput).toHaveBeenCalledTimes(2)
      expect(order).toEqual([
        'write:<view data-color="blue"></view>',
        'publish',
        'register:order.push("first")',
        'mark:first.js',
        'register:order.push("second")',
        'mark:second.js',
        'write:<view data-color="green"></view>',
        'publish',
        'register:void 0',
        'mark:update.js',
      ])
      expect(harness.fullBuild).not.toHaveBeenCalled()
    }
    finally {
      applied.resolve()
    }
  })

  it.each(['page.js', 'page.vue'])('issue #1081: publishes a script-only %s patch without writing unchanged styles', async (sourceName) => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    harness.writeOutput.mockClear()
    const file = path.join(root, 'src', sourceName)
    session.sourceChange(file)
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    await session.whenSettled()
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.registerPatchModules).toHaveBeenCalledExactlyOnceWith('void 0')
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('retains compiler content reasons when a duplicate watcher reports no reason', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({
      assets: [{ fileName: contentFile, code: '<view data-color="blue"></view>' }],
    }))
    const file = path.join(root, 'src/page.js')
    // Core watch can classify the source as a mixed entry update while the
    // Tailwind watcher reports content invalidation for the same path. Both
    // reasons must survive until DevEngine delivers the patch.
    session.sourceChange(file, 'update', ['entry-mixed-asset:1'])
    session.sourceChange(file, 'update', ['tailwind-content:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    await session.whenSettled()
    expect(delta).toHaveBeenCalledOnce()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    harness.nativeOutput = []
    harness.initialOutput = true
    harness.nativeSettlement.mockReset().mockResolvedValue()
    harness.writeOutput.mockReset().mockResolvedValue()
    harness.beforeInitialReady.mockReset().mockResolvedValue()
    harness.beforeFullPrepare.mockReset().mockResolvedValue()
    harness.registerBundleModules.mockReset().mockResolvedValue(1)
    harness.registerPatchModules.mockReset().mockResolvedValue()
    harness.markPayloadDelivered.mockReset().mockResolvedValue()
    harness.closeAdapter.mockReset().mockResolvedValue()
    harness.closeServer.mockReset().mockResolvedValue()
    harness.fullBuild.mockReset().mockImplementation(async () => {
      harness.callbacks!.onOutput(appOutput())
    })
    harness.createServer.mockImplementation(async (options: InlineConfig) => {
      const server = {
        config: {
          inlineConfig: options,
          root: options.root,
          publicDir: path.join(root, 'static-assets'),
          build: { copyPublicDir: true },
          server: {},
          logger: { info: vi.fn(), error: vi.fn() },
        },
        moduleGraph: { getModulesByFile: () => undefined },
        watcher: createMockViteWatcher(),
        middlewares: { use: vi.fn() },
        httpServer: { address: () => undefined },
        close: harness.closeServer,
        restart: vi.fn().mockResolvedValue(undefined),
        async listen() {
          if (!harness.initialOutput) {
            return
          }
          harness.callbacks!.onOutput(appOutput())
          await harness.beforeInitialReady()
          await harness.callbacks!.waitForInitialBundle()
        },
      }
      return server
    })
  })

  it('applies configured build polling to the Vite source watcher', async () => {
    await start(snapshot('red'), [], { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } })
    expect(harness.createServer.mock.calls.at(-1)?.[0].server.watch).toMatchObject({ usePolling: true, interval: 50 })
  })

  it('retains the core ingress event across the session listener and snapshot publication', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    const file = path.join(root, 'src/page.wxss')
    const sourceEvent = { eventId: 'core-ingress', event: 'update' as const, file, receivedAtMs: performance.now() }
    samples.splice(0)
    session.ctx.onStatefulHmrSourceChange!(file, ['style-sidecar:1'], sourceEvent)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(samples.filter(sample => sample.profileMode === 'refresh')).toEqual([
      expect.objectContaining({ status: 'complete', eventId: 'core-ingress', sourceEvents: [sourceEvent] }),
    ])
  })

  it('keeps all pending source identities after an uncorrelated native failure and delivers their later successful patches', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    const sources = ['a.js', 'b.js', 'c.js'].map((file, index) => ({
      eventId: `pending-source-${index}`,
      event: 'update' as const,
      file: path.join(root, 'src', file),
      receivedAtMs: performance.now(),
    }))
    samples.splice(0)
    harness.writeOutput.mockClear()
    session.ctx.onStatefulHmrSourceChange!(sources[0]!.file, [], { ...sources[0]!, eventId: 'older-a' })
    for (const source of sources) {
      session.ctx.onStatefulHmrSourceChange!(source.file, [], source)
    }
    harness.callbacks!.onNativeError(Object.assign(new Error('native transform failed'), { id: sources[0]!.file }))
    expect(samples).toEqual([expect.objectContaining({ status: 'failed', correlation: 'unknown', sourceEvents: [] })])
    expect(samples[0]!.file).toBeUndefined()
    expect(samples[0]!.eventId).toBeUndefined()
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.restart).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
    expect(session.runtime.phase).toBe('stateful')
    for (const [index, source] of sources.entries()) {
      expect(harness.callbacks!.onPatch([source.file], { type: 'Patch', code: 'void 0', filename: `update-${index}.js` })).toBe(true)
      await vi.advanceTimersByTimeAsync(50)
      await session.whenSettled()
    }
    expect(samples.slice(1)).toEqual(sources.map(source => expect.objectContaining({
      status: 'complete',
      correlation: 'known',
      sourceEvents: [source],
      eventId: source.eventId,
    })))
    expect(delta).toHaveBeenCalledTimes(3)
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it.each(['write', 'register'] as const)('keeps a transferred profile pending until replacement %s succeeds', async (stage) => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const original = new StatefulHmrProfile({ root })
    original.source('app.json')
    const profile = original.transfer(original.begin(['app.json'], 'delivery'))!
    await original.close()
    const gate = Promise.withResolvers<void>()
    if (stage === 'write') {
      harness.writeOutput.mockImplementationOnce(() => gate.promise)
    }
    else {
      harness.registerBundleModules.mockImplementationOnce(async () => {
        await gate.promise
        return 1
      })
    }
    const starting = start(snapshot('blue'), [], {}, new Map(), profile)
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.writeOutput).toHaveBeenCalledOnce()
    expect(samples).toEqual([])
    gate.resolve()
    const replacement = await starting
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'complete', completionBoundary: 'output-published', profileMode: 'full' })
    await replacement.close()
    expect(samples).toHaveLength(1)
  })

  it('ends the original profile when a newer source event arrives before replacement publication', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const original = new StatefulHmrProfile({ root })
    original.source('app.json')
    const profile = original.transfer(original.begin(['app.json'], 'delivery'))!
    await original.close()
    const gate = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => gate.promise)
    let context: MutableCompilerContext | undefined
    const starting = start(snapshot('blue'), [], {}, new Map(), profile, (ctx) => {
      context = ctx
    })
    await vi.advanceTimersByTimeAsync(1)
    context!.onStatefulHmrSourceChange!(path.join(root, 'src/app.json'), [])
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'incomplete', file: 'app.json' })
    gate.resolve()
    const replacement = await starting
    await replacement.close()
    expect(samples).toHaveLength(1)
    expect(samples[0]!.totalMs).toBeUndefined()
  })

  it.each(['write', 'register'] as const)('preserves failed replacement %s in the transferred profile', async (stage) => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const original = new StatefulHmrProfile({ root })
    original.source('app.json')
    const profile = original.transfer(original.begin(['app.json'], 'delivery'))!
    await original.close()
    const failure = new Error('replacement publication failed')
    if (stage === 'write') {
      harness.writeOutput.mockRejectedValueOnce(failure)
    }
    else {
      harness.registerBundleModules.mockRejectedValueOnce(failure)
    }
    await expect(start(snapshot('blue'), [], {}, new Map(), profile)).rejects.toBe(failure)
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'failed', completionBoundary: 'output-published' })
    expect(samples[0]!.totalMs).toBeUndefined()
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
    const currentContent = writtenAssets().filter(item => item.fileName === contentFile).at(-1)
    expect(currentContent?.source).toContain('data-color="red"')
    expect(currentContent?.source).not.toContain('data-color="blue"')
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
    expect(delta).toHaveBeenCalledWith(expect.stringContaining('increment'), changedIds, expect.any(Function))
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps atomic child restoration as a patch when the watcher also reports parent directory metadata', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/child-restore-'))
    temporaryDirectories.push(directory)
    const component = path.join(directory, 'index.js')
    const page = path.join(root, 'src/page.js')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
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

  it('hands a real directory FullReload to classic after ignoring metadata-only updates', async () => {
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
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.runtime.fallback?.code).toBe('engine-full-reload')
    expect(session.classic).toHaveBeenCalledOnce()

    await rm(directory, { recursive: true })
    session.sourceChange(directory, 'delete')
    harness.callbacks!.onPatch([directory], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('refreshes a new visual sidecar but hands executable FullReload to classic after directory metadata', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/new-sidecar-'))
    temporaryDirectories.push(directory)
    const session = await start()
    const style = path.join(directory, 'index.wxss')
    await writeFile(style, '.new { color: red; }')
    session.sourceChange(directory)
    session.sourceChange(style, 'create')
    harness.callbacks!.onPatch([directory, style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([style])

    session.rebuild.mockClear()
    const source = path.join(directory, 'index.js')
    await writeFile(source, 'Component({})')
    session.sourceChange(directory)
    session.sourceChange(source, 'create')
    harness.callbacks!.onPatch([directory, source], { type: 'FullReload', reason: 'new entry topology' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback?.code).toBe('engine-full-reload')
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('publishes a mixed visual edit as a patch plus changed assets without a full build', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    harness.writeOutput.mockClear()

    expect(session.patch(['entry-mixed-asset:1'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({
      fileName: pageContentFile,
      source: expect.stringContaining('data-color="blue"'),
    }))
    expect(delta).toHaveBeenCalledTimes(1)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it.each(['Patch', 'Noop'] as const)('keeps a style edit local after a native script is restored to its persisted input (%s)', async (restoreType) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "before" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    expect(getCompilerHmrHost(session.ctx).enabled).toBe(false)
    const patch = async (source: string, type: 'Patch' | 'Noop' = 'Patch') => {
      session.sourceChange(script, 'update', ['entry-direct:1'])
      getCompilerHmrHost(session.ctx).captureNative(script, source)
      harness.callbacks!.onPatch([script], type === 'Noop' ? { type } : { type, code: 'void 0', filename: 'native-update.js', changedIds: [script] })
      await vi.advanceTimersByTimeAsync(100)
    }
    await patch('Page({ data: { marker: "after" } })')
    await patch(original, restoreType)
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    harness.callbacks!.onPatch([style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)

    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ source: expect.stringContaining('data-color="blue"') }))
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('routes compiler-owned style sidecar entry patches through a snapshot refresh', async () => {
    const page = path.join(root, 'src/pages/index.vue')
    const style = path.join(root, 'src/pages/index.css')
    const logicalPage = createLogicalEntryId(page, 'page')
    const session = await start(snapshot('red'), [page], {}, new Map(), undefined, (ctx) => {
      ctx.moduleGraphService.collectAffectedEntries = () => new Set([page])
    })
    getCompilerHmrHost(session.ctx).seed(style, '.page {}')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')

    session.sourceChange(style, 'update', ['style-sidecar:1'])
    expect(harness.callbacks!.onPatch([page], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
      changedIds: [logicalPage],
    })).toBe(false)
    await vi.advanceTimersByTimeAsync(100)

    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(delta).not.toHaveBeenCalled()
  })

  it.each(['success', 'failure'] as const)('tracks the input captured before a full native publication (%s)', async (outcome) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "original" } })'
    const persisted = 'Page({ data: { marker: "persisted" } })'
    const later = 'Page({ data: { marker: "later" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const host = getCompilerHmrHost(session.ctx)
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, persisted)
    const write = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => write.promise)
    const publication = harness.callbacks!.onOutput(appOutput())
    const settled = publication.catch(error => error)
    await vi.advanceTimersByTimeAsync(1)
    // 原生输出已经封存；异步写盘期间的新编译输入不能被记成该产物的源码。
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, later)
    if (outcome === 'failure') {
      write.reject(new Error('partial native write'))
      expect(await settled).toBeInstanceOf(Error)
    }
    else {
      write.resolve()
      await settled
    }
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, outcome === 'success' ? persisted : original)
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'restore.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)

    expect(harness.fullBuild).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1)
  })

  it('keeps a newer script edit dirty while an older restoration patch is being delivered', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "before" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const host = getCompilerHmrHost(session.ctx)
    const delivered = Promise.withResolvers<void>()
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async () => delivered.promise)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, original)
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'restore.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(1)
    expect(delta).toHaveBeenCalledOnce()
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, 'Page({ data: { marker: "newer" } })')
    delivered.resolve()
    await vi.advanceTimersByTimeAsync(1)
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)

    expect(harness.fullBuild).toHaveBeenCalledOnce()
  })

  it.each(['script-first', 'asset-first', 'asset-running'] as const)('persists native scripts when watcher batches split a mixed update (%s)', async (order) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const nativeOutput = (marker: string): StatefulHmrOutputFile[] => [{
      type: 'chunk',
      fileName: 'pages/index/index.js',
      code: `Page({ data: { marker: '${marker}' } });`,
      modules: {},
    }]
    harness.nativeOutput = nativeOutput('before')
    const session = await start(snapshot('red'), [script])
    const published = new Map(harness.nativeOutput.map(item => [item.fileName, item.type === 'chunk' ? item.code : item.source]))
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        published.set(item.fileName, item.type === 'chunk' ? item.code : item.source)
      }
    })
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    harness.nativeOutput = nativeOutput('after')
    const changeScript = () => {
      session.sourceChange(script, 'update', ['entry-direct:1'])
      harness.callbacks!.onPatch([script], {
        type: 'Patch',
        code: 'void 0',
        filename: 'script-update.js',
        changedIds: [script],
      })
    }
    const changeAsset = () => {
      session.sourceChange(style, 'update', ['style-sidecar:1'])
      harness.callbacks!.onPatch([style], { type: 'Noop' })
    }
    if (order === 'script-first') {
      changeScript()
      await vi.advanceTimersByTimeAsync(100)
      expect(harness.fullBuild).not.toHaveBeenCalled()
      changeAsset()
    }
    else {
      const ready = Promise.withResolvers<StatefulHmrSnapshot>()
      if (order === 'asset-running') {
        session.rebuild.mockImplementationOnce(async () => ready.promise)
      }
      changeAsset()
      if (order === 'asset-running') {
        await vi.advanceTimersByTimeAsync(50)
        expect(session.rebuild).toHaveBeenCalledTimes(1)
      }
      changeScript()
      ready.resolve(snapshot('blue'))
    }
    await vi.advanceTimersByTimeAsync(100)

    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
    expect(published.get('pages/index/index.js')).toContain('after')

    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
  })

  it('keeps a native patch local after asset settlement and persists it on the next asset refresh', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    harness.nativeOutput = [{ type: 'chunk', fileName: 'pages/index/index.js', code: original, modules: {} }]
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const published = new Map([['pages/index/index.js', original]])
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        published.set(item.fileName, String(item.type === 'chunk' ? item.code : item.source))
      }
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    harness.callbacks!.onPatch([style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(published.get(contentFile)).toContain('data-color="blue"')

    // 已稳定的资产批次不能使后续独立脚本编辑被强制完整重载。
    harness.nativeOutput = [{ type: 'chunk', fileName: 'pages/index/index.js', code: current, modules: {} }]
    session.sourceChange(script, 'update', ['entry-direct:1'])
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    expect(harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'native-update.js', changedIds: [script] })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(published.get('pages/index/index.js')).toBe(original)

    // 下一次资产刷新以未持久化的实际脚本输入升级完整发布。
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    harness.callbacks!.onPatch([style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(published.get('pages/index/index.js')).toContain(current)
  })

  it.each(['prepare', 'write'] as const)('persists a raw script saved during asset %s when its notification arrives after settlement', async (boundary) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    let saved = false
    const overlap = {
      ...snapshot('blue'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(original).digest('hex')]]),
      captureNativeScriptDrift: () => saved ? new Map([[script, createHash('sha256').update(current).digest('hex')]]) : new Map<string, string>(),
    }
    session.rebuild.mockImplementationOnce(async () => {
      if (boundary === 'prepare') {
        saved = true
      }
      return overlap
    })
    harness.writeOutput.mockImplementationOnce(async () => {
      if (boundary === 'write') {
        saved = true
      }
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(saved).toBe(true)
    expect(harness.fullBuild).not.toHaveBeenCalled()
    // 普通后续资产刷新不能消费尚未收到真实脚本通知的重叠输入。
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'overlap.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).not.toHaveBeenCalled()
    getCompilerHmrHost(session.ctx).captureNative(script, `${current}\n// independent`)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'independent.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).toHaveBeenCalledOnce()
  })

  it('retains overlap debt when the correcting full output fails even if the source is restored', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), captureNativeScriptDrift: () => new Map([[script, createHash('sha256').update(current).digest('hex')]]) })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    harness.writeOutput.mockRejectedValueOnce(new Error('overlap full write failed'))
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(100)
    await expect(session.whenSettled()).rejects.toThrow('overlap full write failed')
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    getCompilerHmrHost(session.ctx).captureNative(script, original)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it('keeps a newer raw overlap observed during the correcting full write for its own notification', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const newer = 'Page({ data: { marker: "newer" } })'
    const hash = (source: string) => createHash('sha256').update(source).digest('hex')
    let observed = current
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValue({ ...snapshot('blue'), captureNativeScriptDrift: () => new Map([[script, hash(observed)]]) })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    harness.writeOutput.mockImplementationOnce(async () => {
      observed = newer
    })
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    session.rebuild.mockResolvedValue(snapshot('blue'))
    getCompilerHmrHost(session.ctx).captureNative(script, newer)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it('persists a native input already consumed by settled assets when its real notification arrives late', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValue({
      ...snapshot('blue'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]),
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })

    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))

    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'late-native.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).not.toHaveBeenCalled()

    // 完整发布消费实际输入后，同版本通知与后续独立编辑均不应再次完整构建。
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Noop' })
    getCompilerHmrHost(session.ctx).captureNative(script, `${current}\n// independent`)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'independent-native.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).toHaveBeenCalledOnce()
  })

  it('does not adopt native input debt from an asset write that fails', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValueOnce({
      ...snapshot('blue'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]),
    })
    harness.writeOutput.mockRejectedValueOnce(new Error('asset publication failed'))
    session.refresh()
    const failed = expect(session.whenSettled()).rejects.toThrow('asset publication failed')
    await vi.advanceTimersByTimeAsync(100)
    await failed
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'native-after-failure.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(delta).toHaveBeenCalledOnce()
  })

  it.each(['prepare', 'write'] as const)('joins a real native notification received during independent delivery snapshot %s', async (phase) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const component = path.join(root, 'src/component.vue')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script, component], {}, new Map([[script, original]]))
    const consumed = { ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]) }
    const prepared = Promise.withResolvers<StatefulHmrSnapshot>()
    const published = Promise.withResolvers<void>()
    session.rebuild.mockResolvedValue(consumed)
    if (phase === 'prepare') {
      session.rebuild.mockImplementationOnce(() => prepared.promise)
    }
    else {
      harness.writeOutput.mockImplementationOnce(() => published.promise)
    }
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.sourceChange(component, 'update', ['entry-mixed-asset:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Patch', code: 'void 0', filename: 'component.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledOnce()

    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    expect(harness.fullBuild).not.toHaveBeenCalled()
    prepared.resolve(consumed)
    published.resolve()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).not.toHaveBeenCalled()
  })

  it('discards native input facts from an asset snapshot superseded before publication', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const prepared = Promise.withResolvers<StatefulHmrSnapshot>()
    session.rebuild.mockImplementationOnce(() => prepared.promise).mockResolvedValue({
      ...snapshot('green'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(original).digest('hex')]]),
    })
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    session.refresh()
    prepared.resolve({ ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]) })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(writtenAssets().filter(item => item.fileName === contentFile).at(-1)?.source).toContain('data-color="green"')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'independent.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(delta).toHaveBeenCalledOnce()
  })

  it('retains committed asset input debt when the correcting native full write fails', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValue({ ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]) })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput(appOutput())
    })
    harness.writeOutput.mockRejectedValueOnce(new Error('native full write failed'))
    session.sourceChange(script, 'update', ['entry-direct:1'])
    const failed = expect(session.whenSettled()).rejects.toThrow('native full write failed')
    await vi.advanceTimersByTimeAsync(100)
    await failed
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it('restores assets with a full publication even when the delayed native edit reverted to persisted input', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const changed = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(changed).digest('hex')]]) })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    session.rebuild.mockResolvedValue({ ...snapshot('red'), nativeScriptVersions: new Map([[script, createHash('sha256').update(original).digest('hex')]]) })
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(writtenAssets().filter(item => item.fileName === contentFile).at(-1)?.source).toContain('data-color="red"')
  })

  it('preserves a newer native event during the correcting full write and clears only consumed input debt', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const changed = 'Page({ data: { marker: "after" } })'
    const newest = 'Page({ data: { marker: "newest" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const versioned = (color: string, source: string) => ({ ...snapshot(color), nativeScriptVersions: new Map([[script, createHash('sha256').update(source).digest('hex')]]) })
    session.rebuild.mockResolvedValue(versioned('blue', changed))
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    const published = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => published.promise)
    getCompilerHmrHost(session.ctx).captureNative(script, changed)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    session.rebuild.mockResolvedValue(versioned('green', newest))
    getCompilerHmrHost(session.ctx).captureNative(script, newest)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    published.resolve()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Noop' })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it.each(['failed', 'superseded'] as const)('retains unpersisted native scripts across a %s full build', async (outcome) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const session = await start(snapshot('red'), [script])
    const ready = Promise.withResolvers<void>()
    harness.fullBuild.mockImplementationOnce(async () => {
      await ready.promise
      if (outcome === 'failed') {
        throw new Error('native publication failed')
      }
      await harness.callbacks!.onOutput(appOutput())
    })
    session.sourceChange(script, 'update', ['entry-direct:1'])
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)

    if (outcome === 'superseded') {
      session.sourceChange(script, 'update', ['entry-direct:1'])
    }
    ready.resolve()
    await vi.advanceTimersByTimeAsync(1)
    if (outcome === 'failed') {
      expect(harness.fullBuild).toHaveBeenCalledTimes(1)
      session.sourceChange(style, 'update', ['style-sidecar:1'])
    }
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(session.rebuild.mock.calls[1]?.[0]).toContain(script)

    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it.each(['running', 'written'] as const)('builds one mixed snapshot at the native patch boundary (%s)', async (phase) => {
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    const file = path.join(root, 'src/page.vue')
    const ready = Promise.withResolvers<StatefulHmrSnapshot>()
    session.rebuild.mockImplementationOnce(async () => ready.promise)
    session.sourceChange(file, 'update', ['entry-mixed-asset:1'])
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    if (phase === 'written') {
      ready.resolve(snapshot('blue'))
      await vi.advanceTimersByTimeAsync(50)
    }
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(false)
    ready.resolve(snapshot('blue'))
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
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
      fileName: pageContentFile,
      source: expect.stringContaining('data-color="blue"'),
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

  it.each(['style', 'template'] as const)('prepares native Vue %s inputs from Noop and preserves only supported restoration delivery', async (kind) => {
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>before</view></template><style>view { color: red }</style>'
    const changed = kind === 'style'
      ? previous.replace('color: red', 'color: blue')
      : previous.replace('<view>before</view>', '<view>after</view>')
    const visualSnapshot = (source: string) => {
      const value = kind === 'style'
        ? compiledStylesheetSnapshot(source.includes('color: blue') ? 'blue' : 'red')
        : snapshot('red')
      value.output.push({ type: 'asset', fileName: `${route}.wxml`, source: source.includes('<view>after</view>') ? '<view>after</view>' : '<view>before</view>' })
      return value
    }
    const session = await start(visualSnapshot(previous), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    host.seed(component, previous)
    host.captureNative(component, previous)
    host.register('source-provider', prepare)
    expect(host.ownsDependency(component)).toBe(true)
    expect(host.isNativeSource(component)).toBe(true)

    for (const [index, source] of [changed, previous].entries()) {
      harness.writeOutput.mockClear()
      session.rebuild.mockResolvedValueOnce(visualSnapshot(source))
      host.captureNative(component, source)
      session.sourceChange(component, 'update', [kind === 'style' ? 'entry-style-only:1' : 'entry-local-asset:1'])
      await vi.advanceTimersByTimeAsync(40)
      await session.whenSettled()
      expect(prepare).toHaveBeenCalledTimes(index)

      // JS 无补丁不代表编译器的样式或模板输入已发布，恢复原文同样需要准备。
      harness.callbacks!.onPatch([component], { type: 'Noop' })
      await vi.advanceTimersByTimeAsync(40)
      if (kind === 'template') {
        await session.whenSettled()
      }

      expect(prepare).toHaveBeenCalledTimes(index + 1)
      const input = prepare.mock.calls[index]?.[0]
      expect(input?.changedFiles).toEqual([component])
      expect(input?.sources.get(compilerSourceId(component))).toBe(source)
      expect(session.rebuild).toHaveBeenNthCalledWith(index + 1, [component], input?.sources)
      if (kind === 'style') {
        expect(session.runtime.fallback?.code).toBe('stylesheet-output')
        expect(session.classic).toHaveBeenCalledOnce()
        expect(harness.writeOutput).not.toHaveBeenCalled()
        host.captureNative(component, previous)
        session.sourceChange(component, 'update', ['entry-style-only:1'])
        expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
        await vi.advanceTimersByTimeAsync(40)
        expect(prepare).toHaveBeenCalledOnce()
        break
      }
      expect(writtenAssets().findLast(asset => asset.fileName === `${route}.wxml`)?.source).toContain(index === 0 ? '<view>after</view>' : '<view>before</view>')

      session.sourceChange(component, 'update', ['entry-local-asset:1'])
      expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
      await vi.advanceTimersByTimeAsync(40)
      await session.whenSettled()
      expect(prepare).toHaveBeenCalledTimes(index + 1)
    }
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledTimes(kind === 'style' ? 1 : 0)
    expect(delta).not.toHaveBeenCalled()
  })

  it('freezes all compiler-owned native visual inputs once for a multi-file Noop', async () => {
    const style = path.join(root, 'src/style.vue')
    const template = path.join(root, 'src/template.vue')
    const previous = '<script setup>const count = 1</script><template><view>before</view></template><style>view { color: red }</style>'
    const changed = new Map([[style, previous.replace('color: red', 'color: blue')], [template, previous.replace('<view>before</view>', '<view>after</view>')]])
    const initial = compiledStylesheetSnapshot('red')
    initial.output.push({ type: 'asset', fileName: `${route}.wxml`, source: '<view>before</view>' })
    const session = await start(initial, [style, template], {}, new Map([[style, previous], [template, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.register('source-provider', prepare)
    for (const [file, source] of changed) {
      host.seed(file, previous)
      host.captureNative(file, source)
      session.sourceChange(file, 'update', [file === style ? 'entry-style-only:1' : 'entry-local-asset:1'])
    }
    const next = compiledStylesheetSnapshot('blue')
    next.output.push({ type: 'asset', fileName: `${route}.wxml`, source: '<view>after</view>' })
    session.rebuild.mockResolvedValueOnce(next)
    const freeze = vi.spyOn(host, 'freeze')
    expect(harness.callbacks!.onPatch([style, template], { type: 'Noop' })).toBe(true)
    harness.writeOutput.mockClear()
    await vi.advanceTimersByTimeAsync(40)

    expect(freeze).toHaveBeenCalledExactlyOnceWith([style, template])
    expect(prepare).toHaveBeenCalledOnce()
    const input = prepare.mock.calls[0]?.[0]
    expect(input?.changedFiles).toEqual([style, template])
    for (const [file, source] of changed) {
      expect(input?.sources.get(compilerSourceId(file))).toBe(source)
    }
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([style, template], input?.sources)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(session.runtime.fallback?.code).toBe('stylesheet-output')
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
  })

  it.each(['style', 'template'] as const)('retains a known native Vue %s change when a later script event replaces its classification', async (kind) => {
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>before</view></template><style>view { color: red }</style>'
    const changed = (kind === 'style'
      ? previous.replace('color: red', 'color: blue')
      : previous.replace('<view>before</view>', '<view>after</view>')).replace('count = 1', 'count = 2')
    const session = await start(kind === 'style' ? compiledStylesheetSnapshot('red') : snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.seed(component, previous)
    host.captureNative(component, previous)
    host.register('source-provider', prepare)
    expect(host.hasVisualChanges([component])).toBe(false)
    host.captureNative(component, changed)
    expect(host.hasVisualChanges([component])).toBe(true)
    const next = kind === 'style' ? compiledStylesheetSnapshot('blue') : snapshot('blue')
    next.output.push({ type: 'asset', fileName: `${route}.wxml`, source: '<view>after</view>' })
    session.rebuild.mockResolvedValueOnce(next)
    session.sourceChange(component, 'update', [kind === 'style' ? 'entry-style-only:1' : 'entry-local-asset:1'])
    session.sourceChange(component, 'update', ['entry-direct:1'])
    const freeze = vi.spyOn(host, 'freeze')
    harness.writeOutput.mockClear()
    harness.callbacks!.onPatch([component], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(40)
    if (kind === 'template') {
      await session.whenSettled()
    }

    expect(prepare).toHaveBeenCalledOnce()
    expect(freeze).toHaveBeenCalledExactlyOnceWith([component])
    const input = prepare.mock.calls[0]?.[0]
    expect(input?.sources.get(compilerSourceId(component))).toBe(changed)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([component], input?.sources)
    if (kind === 'style') {
      expect(harness.writeOutput).not.toHaveBeenCalled()
      expect(session.runtime.fallback?.code).toBe('stylesheet-output')
    }
    else {
      expect(writtenAssets().findLast(asset => asset.fileName === `${route}.wxml`)?.source).toContain('<view>after</view>')
    }
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledTimes(kind === 'style' ? 1 : 0)
  })

  it.each([
    ['Patch', 'tailwind-only'],
    ['Patch', 'core-style-then-tailwind'],
    ['Noop', 'tailwind-only'],
    ['Noop', 'core-style-then-tailwind'],
  ] as const)('hands native Vue stylesheet output to sticky classic with %s and %s notifications', async (type, notification) => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>same</view></template><style>.probe { color: red; }</style>'
    const styleSnapshot = (color: string): StatefulHmrSnapshot => ({
      ...compiledStylesheetSnapshot('white'),
      output: [
        ...compiledStylesheetSnapshot('white').output,
        { type: 'asset', fileName: `${route}.wxss`, source: `.probe { color: ${color}; }` },
      ],
      entryIds: [component],
      templateRegistrationSignatures: new Map([[component, 'same-template-registration']]),
    })
    const session = await start(styleSnapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.seed(component, previous)
    host.register('source-provider', prepare)
    const freeze = vi.spyOn(host, 'freeze')
    harness.writeOutput.mockClear()

    for (const [index, color] of ['blue', 'red', 'green'].entries()) {
      const changed = previous.replace('color: red', `color: ${color}`)
      host.captureNative(component, changed)
      session.rebuild.mockResolvedValueOnce(styleSnapshot(color))
      if (notification === 'core-style-then-tailwind') {
        session.sourceChange(component, 'update', ['entry-style-only:1'])
      }
      session.sourceChange(component, 'update', ['tailwind-content:1'])
      expect(harness.callbacks!.onPatch([component], type === 'Noop'
        ? { type }
        : { type, code: 'void 0', filename: `update-${index}.js`, changedIds: [component] })).toBe(index === 0)
      await vi.advanceTimersByTimeAsync(40)
      expect(session.runtime.fallback).toMatchObject({ code: 'stylesheet-output', files: [`${route}.wxss`] })
      expect(session.classic).toHaveBeenCalledOnce()
    }

    expect(prepare).toHaveBeenCalledOnce()
    expect(freeze).toHaveBeenCalledExactlyOnceWith([component])
    const input = prepare.mock.calls[0]?.[0]
    expect(input?.changedFiles).toEqual([component])
    expect(input?.sources.get(compilerSourceId(component))).toBe(previous.replace('color: red', 'color: blue'))
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([component], input?.sources)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
    expect(harness.registerPatchModules).not.toHaveBeenCalled()
    expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('publishes a compiler-owned native Vue script Patch without rebuilding its unchanged visuals', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>same</view></template><style>.probe { color: red; }</style>'
    const changed = previous.replace('count = 1', 'count = 2')
    const session = await start(snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.seed(component, previous)
    host.register('source-provider', prepare)
    host.captureNative(component, changed)
    expect(host.hasVisualChanges([component])).toBe(false)
    harness.writeOutput.mockClear()
    session.sourceChange(component, 'update', ['tailwind-content:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Patch', code: 'void 0', filename: 'update.js', changedIds: [component] })).toBe(true)
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()

    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]?.[0].sources.get(compilerSourceId(component))).toBe(changed)
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.registerPatchModules).toHaveBeenCalledExactlyOnceWith('void 0')
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(session.classic).not.toHaveBeenCalled()
  })

  it.each(['script-only-vue', 'unchanged-vue', 'native-script', 'non-compiler-vue'] as const)('consumes a %s Noop without compiler delivery', async (kind) => {
    const component = path.join(root, kind === 'native-script' ? 'src/native.js' : 'src/native.vue')
    const previous = kind === 'native-script'
      ? 'const count = 1; Page({ data: { count } })'
      : '<script setup>const count = 1</script><template><view>before</view></template><style>view { color: red }</style>'
    const changed = kind === 'unchanged-vue'
      ? previous
      : kind === 'script-only-vue' || kind === 'native-script'
        ? previous.replace('count = 1', 'count = 2')
        : previous.replace('color: red', 'color: blue')
    const session = await start(snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.register('source-provider', prepare)
    if (kind !== 'non-compiler-vue') {
      host.seed(component, previous)
    }
    host.captureNative(component, changed)
    const reasons = kind === 'native-script' || kind === 'non-compiler-vue' ? ['entry-direct:1'] : ['entry-style-only:1']
    session.sourceChange(component, 'update', reasons)
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()

    expect(prepare).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(session.classic).not.toHaveBeenCalled()
  })

  it.each(['uncaptured-initial-source', 'unpublished-native-source', 'missing-current-source'] as const)('hands a native Vue Noop with %s to classic without inventing a baseline', async (kind) => {
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>before</view></template>'
    const session = await start(snapshot('red'), kind === 'unpublished-native-source' ? [] : [component], {}, kind === 'uncaptured-initial-source' ? new Map() : new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    const freeze = vi.spyOn(host, 'freeze')
    host.seed(component, previous)
    host.captureNative(component, previous.replace('<view>before</view>', '<view>after</view>'))
    if (kind === 'missing-current-source') {
      host.capture(component, null)
    }
    host.register('source-provider', prepare)
    harness.writeOutput.mockClear()
    session.sourceChange(component, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
    await vi.advanceTimersByTimeAsync(40)
    expect(session.classic).toHaveBeenCalledOnce()
    session.runtime.markClassic()
    await session.runtime.whenSettled()

    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback).toMatchObject({ code: 'native-registration', files: [component] })
    expect(freeze).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it.each(['prepare', 'syntax', 'write'] as const)('preserves a native Vue Noop %s error and invalidates its failed comparison baseline', async (stage) => {
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>before</view></template>'
    const session = await start(snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const failure = stage === 'syntax' ? new SyntaxError('invalid Vue template') : new Error(`${stage} failed`)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    const freeze = vi.spyOn(host, 'freeze')
    const events = vi.fn()
    session.events.watcher.on('event', events)
    host.seed(component, previous)
    host.captureNative(component, stage === 'syntax' ? '<template><view>' : previous.replace('<view>before</view>', '<view>after</view>'))
    host.register('source-provider', prepare)
    harness.writeOutput.mockClear()
    if (stage === 'prepare') {
      prepare.mockRejectedValueOnce(failure)
    }
    else if (stage === 'syntax') {
      session.rebuild.mockRejectedValueOnce(failure)
    }
    else {
      harness.writeOutput.mockRejectedValueOnce(failure)
    }
    session.sourceChange(component, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(true)
    const rejected = expect(session.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(40)
    await rejected

    expect(prepare).toHaveBeenCalledOnce()
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR', error: failure }))
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.runtime.fallback).toBeUndefined()
    session.sourceChange(component, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
    await vi.advanceTimersByTimeAsync(40)
    expect(session.classic).toHaveBeenCalledOnce()
    session.runtime.markClassic()
    await session.runtime.whenSettled()

    expect(freeze).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledOnce()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback).toMatchObject({ code: 'native-registration', files: [component] })
  })

  const nativeTemplateAdmissionCases = (['Noop', 'Patch'] as const).flatMap(type =>
    (['native', 'windows-canonical'] as const).flatMap(identity =>
      (['text', 'structure'] as const).map(edit => ({ type, identity, edit }))))
  it.each(nativeTemplateAdmissionCases)('rejects a known native template $edit $type before provider preparation or snapshot compilation ($identity)', async ({ type, identity, edit }) => {
    const component = nativeTemplateSourceFile(identity)
    const previous = '<script setup>const count = 1</script><template><view>before</view></template>'
    const session = await start({
      ...snapshot('red'),
      entryIds: [component],
      templateRegistrationSignatures: new Map([[component, 'registered-template']]),
    }, [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    const freeze = host.freeze.bind(host)
    const capture = vi.spyOn(host, 'freeze').mockImplementation((files) => {
      const input = freeze(files)
      // 快速恢复发生在封存后；准入只能检查封存的修改，不能改读活动输入。
      host.captureNative(component, previous)
      return input
    })
    host.seed(component, previous)
    host.captureNative(component, edit === 'text'
      ? previous.replace('<view>before</view>', '<view>after</view>')
      : previous.replace('</template>', '<view hidden>audit-marker</view>\n</template>'))
    host.register('source-provider', prepare)
    session.rebuild.mockResolvedValueOnce({
      ...snapshot('blue'),
      entryIds: [component],
      templateRegistrationSignatures: new Map([[component, 'new-template-registration']]),
    })
    harness.writeOutput.mockClear()
    session.sourceChange(component, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], type === 'Noop'
      ? { type }
      : { type, code: 'void 0', filename: 'update.js', changedIds: [component] })).toBe(false)
    await vi.advanceTimersByTimeAsync(40)
    expect(session.classic).toHaveBeenCalledOnce()
    session.runtime.markClassic()
    await session.runtime.whenSettled()

    expect(capture).toHaveBeenCalledExactlyOnceWith([component])
    expect(prepare).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledOnce()
    expect(session.runtime.fallback?.code).toBe('native-registration')
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(delta).not.toHaveBeenCalled()
  })

  it.each([false, true].flatMap(success => (['native', 'windows-canonical'] as const).map(identity => ({ success, identity }))))('advances native template text baselines only after a successful full publication (success=$success, $identity)', async ({ success, identity }) => {
    const component = nativeTemplateSourceFile(identity)
    const previous = '<script setup>const count = 1</script><template><view>before</view></template>'
    const changed = previous.replace('before', 'after')
    harness.nativeOutput = [{ type: 'chunk', fileName: `${route}.js`, code: 'Page({});', modules: { [component]: {} } }]
    const session = await start({
      ...snapshot('red'),
      entryIds: [component],
      templateRegistrationSignatures: new Map([[component, 'registered-template']]),
    }, [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.seed(component, previous)
    host.register('source-provider', prepare)
    host.captureNative(component, changed)
    const failure = new Error('native full output write failed')
    if (!success) {
      harness.writeOutput.mockRejectedValueOnce(failure)
    }
    const publication = harness.callbacks!.onOutput(appOutput(), 'full')
    if (success) {
      await publication
    }
    else {
      await expect(publication).rejects.toBe(failure)
    }
    session.sourceChange(component, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
    await vi.advanceTimersByTimeAsync(40)
    expect(prepare).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(session.classic).toHaveBeenCalledTimes(success ? 0 : 1)
    if (!success) {
      expect(session.runtime.fallback?.code).toBe('native-registration')
    }
  })

  it('does not trust a live Vue input captured during a full output write', async () => {
    const component = path.join(root, 'src/native.vue')
    const previous = '<script setup>const count = 1</script><template><view>before</view></template><style>view { color: red }</style>'
    const changed = previous.replace('<view>before</view>', '<view>after</view>')
    harness.nativeOutput = [{ type: 'chunk', fileName: `${route}.js`, code: 'Page({});', modules: { [component]: {} } }]
    const session = await start(snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    const freeze = vi.spyOn(host, 'freeze')
    host.seed(component, previous)
    host.register('source-provider', prepare)
    const writing = Promise.withResolvers<void>()
    const write = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => {
      writing.resolve()
      await write.promise
    })
    const publication = harness.callbacks!.onOutput(appOutput(), 'full')
    try {
      await writing.promise
      host.captureNative(component, changed)
      session.sourceChange(component, 'update', ['entry-local-asset:1'])
      write.resolve()
      await publication

      expect(host.readSource(component)).toBe(changed)
      expect(host.isNativeSource(component)).toBe(true)
      expect(writtenAssets().findLast(asset => asset.fileName === contentFile)?.source).toContain('data-color="red"')
      expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
      await vi.advanceTimersByTimeAsync(40)
      expect(session.classic).toHaveBeenCalledOnce()
      expect(session.runtime.fallback).toMatchObject({ code: 'native-registration', files: [component] })
      session.runtime.markClassic()
      await session.runtime.whenSettled()
      expect(freeze).not.toHaveBeenCalled()
      expect(prepare).not.toHaveBeenCalled()
      expect(session.rebuild).not.toHaveBeenCalled()
      expect(harness.fullBuild).not.toHaveBeenCalled()
    }
    finally {
      write.resolve()
      await publication
    }
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

  it('prepares a refresh from the raw source captured before its notification', async () => {
    const template = path.join(root, 'src/page.wxml')
    const previous = '<view data-color="red"></view>'
    const changed = '<view data-color="blue"></view>'
    const session = await start(snapshot('red'), [], {}, new Map([[template, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.register('source-provider', prepare)
    host.captureNative(template, changed)
    session.sourceChange(template, 'update', ['entry-local-asset:1'])

    // 定时器只派发既定 debounce；是否使用本轮输入由真实 preparation/rebuild 观察证明。
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()

    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]?.[0]).toMatchObject({ changedFiles: [template] })
    const sources = session.rebuild.mock.calls[0]?.[1]
    expect(sources?.get(compilerSourceId(template))).toBe(changed)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('waits for refresh output and preparation disposal before completing its event and profile', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    await session.whenSettled()
    const written = Promise.withResolvers<void>()
    const disposed = Promise.withResolvers<void>()
    const dispose = vi.fn(() => disposed.promise)
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    const events = vi.fn()
    session.events.watcher.on('event', events)
    events.mockClear()
    samples.splice(0)
    harness.writeOutput.mockClear().mockImplementationOnce(() => written.promise)
    try {
      session.refresh()
      const settled = session.whenSettled()
      await vi.advanceTimersByTimeAsync(40)
      expect(harness.writeOutput).toHaveBeenCalledOnce()
      expect(dispose).not.toHaveBeenCalled()
      expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
      written.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(dispose).toHaveBeenCalledOnce()
      expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
      expect(samples).toEqual([])
      disposed.resolve()
      await settled
      expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
      expect(samples).toEqual([expect.objectContaining({ profileMode: 'refresh', status: 'complete' })])
    }
    finally {
      written.resolve()
      disposed.resolve()
    }
  })

  it('reports disposal failure while retaining committed output as the next refresh baseline', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    await session.whenSettled()
    const failure = new Error('refresh disposal failed')
    const dispose = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined)
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    const events = vi.fn()
    session.events.watcher.on('event', events)
    events.mockClear()
    samples.splice(0)
    harness.writeOutput.mockClear()
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
    expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR', error: failure }))
    expect(samples).toEqual([expect.objectContaining({ profileMode: 'refresh', status: 'failed' })])
    expect(samples[0]!.totalMs).toBeUndefined()

    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(samples.at(-1)).toMatchObject({ profileMode: 'refresh', status: 'complete' })
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('preserves both publication and cleanup failures without entering full resynchronization', async () => {
    const session = await start()
    const original = new Error('refresh write failed')
    const cleanup = new Error('refresh disposal failed')
    const dispose = vi.fn(() => {
      throw cleanup
    })
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    harness.writeOutput.mockClear().mockRejectedValueOnce(original)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toMatchObject({ cause: original, errors: [original, cleanup] })
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(dispose).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('does not transfer a topology profile or restart until refresh disposal succeeds', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    const failure = new Error('topology preparation disposal failed')
    const dispose = vi.fn(() => {
      throw failure
    })
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    harness.writeOutput.mockClear()
    samples.splice(0)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(140)
    await rejected
    expect(dispose).toHaveBeenCalledOnce()
    expect(session.restart).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(samples).toEqual([expect.objectContaining({ profileMode: 'refresh', status: 'failed' })])
  })

  it('waits for pending refresh preparation and its disposal when the session closes', async () => {
    const session = await start()
    await session.whenSettled()
    const prepared = Promise.withResolvers<WeappCompilerHmrPreparation>()
    const disposal = Promise.withResolvers<void>()
    const dispose = vi.fn(() => disposal.promise)
    const prepare = vi.fn(() => prepared.promise)
    getCompilerHmrHost(session.ctx).register('provider', prepare)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    expect(prepare).toHaveBeenCalledOnce()
    let closed = false
    const closing = session.close().then(() => {
      closed = true
    })
    try {
      prepared.resolve({ dispose })
      await vi.advanceTimersByTimeAsync(0)
      expect(dispose).toHaveBeenCalledOnce()
      expect(closed).toBe(false)
      expect(session.rebuild).not.toHaveBeenCalled()
      expect(harness.writeOutput).not.toHaveBeenCalled()
      disposal.resolve()
      await closing
      expect(closed).toBe(true)
    }
    finally {
      prepared.resolve({ dispose })
      disposal.resolve()
      await closing
    }
  })

  it('retains cleanup rejection during pending refresh close and still releases later session resources', async () => {
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(() => {})
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    await session.whenSettled()
    const prepared = Promise.withResolvers<WeappCompilerHmrPreparation>()
    const failure = new Error('closing preparation disposal failed')
    const dispose = vi.fn(() => {
      throw failure
    })
    getCompilerHmrHost(session.ctx).register('provider', () => prepared.promise)
    const closeProfile = vi.spyOn(StatefulHmrProfile.prototype, 'close')
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    const closing = session.close()
    expect(session.close()).toBe(closing)
    const rejected = expect(closing).rejects.toBe(failure)
    // 原 scheduler 已进入 close 等待，再释放 preparation，单独锁住清理拒绝传播。
    await vi.advanceTimersByTimeAsync(0)
    prepared.resolve({ dispose })
    await rejected
    // 已明确验收同一拒绝，不让通用 afterEach 把预期拒绝重复报告为 hook 故障。
    watchers.splice(watchers.indexOf(session.watcher), 1)
    expect(dispose).toHaveBeenCalledOnce()
    expect(harness.closeAdapter).toHaveBeenCalledOnce()
    expect(closeProfile).toHaveBeenCalledOnce()
    expect(harness.closeServer).toHaveBeenCalledOnce()
    await expect(session.close()).rejects.toBe(failure)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('disposes a superseded refresh preparation and rebuilds only the next fixed input', async () => {
    const session = await start()
    const style = path.join(root, 'src/page.wxss')
    const host = getCompilerHmrHost(session.ctx)
    const first = Promise.withResolvers<WeappCompilerHmrPreparation>()
    const firstDispose = vi.fn()
    const secondDispose = vi.fn()
    const prepare = vi.fn((_input: WeappCompilerHmrRequest) => Promise.resolve({ dispose: secondDispose })).mockImplementationOnce(() => first.promise)
    host.register('provider', prepare)
    host.capture(style, 'blue')
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    expect(prepare).toHaveBeenCalledOnce()
    host.capture(style, 'green')
    session.refresh()
    first.resolve({ dispose: firstDispose })
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(secondDispose).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare.mock.calls[0]![0].sources.get(compilerSourceId(style))).toBe('blue')
    expect(prepare.mock.calls[1]![0].sources.get(compilerSourceId(style))).toBe('green')
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([style], prepare.mock.calls[1]![0].sources)
  })

  it('promotes a refresh generation rejection to one full rebuild without preparing newer inputs', async () => {
    const session = await start()
    const file = path.join(root, 'src/page.wxss')
    const rejection = new CompilerHmrResyncError([file], 'frozen roots no longer match')
    const dispose = vi.fn()
    const prepare = vi.fn(async () => ({ dispose }))
    getCompilerHmrHost(session.ctx).register('provider', prepare)
    session.rebuild.mockRejectedValueOnce(rejection)
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(prepare).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
    expect(session.rebuild.mock.calls).toEqual([[[file], expect.any(Map)], [[file]]])
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    const server = await harness.createServer.mock.results.at(-1)!.value
    expect(server.config.logger.info).toHaveBeenCalledWith(expect.stringContaining(rejection.message))
  })

  it('retains a resync error with cleanup failure instead of treating the generation as released', async () => {
    const session = await start()
    const rejection = new CompilerHmrResyncError([], 'frozen generation rejected')
    const cleanup = new Error('generation still held')
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose: () => {
      throw cleanup
    } }))
    session.rebuild.mockRejectedValueOnce(rejection)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toMatchObject({ cause: rejection, errors: [rejection, cleanup] })
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('preserves the visual before value for a mixed patch arriving after a refresh', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const component = path.join(root, 'src/component.vue')
    const previous = '<script setup>const count = 1</script><template><view>{{ count }}</view></template><style>view { color: red }</style>'
    const changed = previous.replace('<view>{{ count }}</view>', '<view>updated {{ count }}</view>')
    const session = await start(snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    host.register('source-provider', async () => ({}))
    host.captureNative(component, changed)
    session.sourceChange(component, 'update', ['entry-local-asset:1'])
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(host.hasVisualChanges([component])).toBe(true)

    session.sourceChange(component, 'update', ['entry-mixed-asset:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'late-mixed.js',
      changedIds: [component],
    })).toBe(true)
    await session.whenSettled()

    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('late-mixed.js')
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

  it('boots with the native graph prelude across full, additional and snapshot publications', async () => {
    const scopes = ['', 'feature/']
    const withPrelude = (color: string) => {
      const value = snapshot(color)
      value.output.push(...scopes.map(prefix => ({
        type: 'asset' as const,
        fileName: `${prefix}app.prelude.js`,
        source: `require("./snapshot-installer.js").installWebRuntimeGlobals({ targets: [${JSON.stringify(color === 'red' ? 'fetch' : 'Headers')}] }).ready;`,
      })))
      return value
    }
    const nativeOutput = (version: string): StatefulHmrOutputFile[] => scopes.flatMap(prefix => [
      {
        type: 'asset',
        fileName: `${prefix}app.prelude.js`,
        source: `require("./native-${version}.js").installWebRuntimeGlobals().ready;`,
      },
      {
        type: 'chunk',
        fileName: `${prefix}native-${version}.js`,
        code: `exports.installWebRuntimeGlobals = () => ({ ready: ${JSON.stringify(`${prefix}${version}`)} });`,
      },
      {
        type: 'chunk',
        fileName: `${prefix}snapshot-installer.js`,
        code: '__rolldown_runtime__.registerModule("facade", { exports: {} });',
      },
    ])
    const published = new Map<string, StatefulHmrOutputFile>()
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        published.set(item.fileName, item)
      }
    })
    const boot = (prefix: string) => {
      const prelude = published.get(`${prefix}app.prelude.js`)
      if (prelude?.type !== 'asset') {
        throw new Error(`Missing native prelude in ${prefix || 'main'}`)
      }
      return runInNewContext(String(prelude.source), {
        require(request: string) {
          const chunk = published.get(path.join(prefix, request))
          if (chunk?.type !== 'chunk') {
            throw new Error(`Missing native installer: ${request}`)
          }
          const exports = {}
          runInNewContext(chunk.code, { exports, __rolldown_runtime__: { registerModule() {} } })
          return exports
        },
      })
    }
    harness.nativeOutput = nativeOutput('initial')
    const session = await start(withPrelude('red'))
    expect(scopes.map(boot)).toEqual(['initial', 'feature/initial'])

    await harness.callbacks!.onOutput(nativeOutput('additional'), 'additional')
    expect(scopes.map(boot)).toEqual(['additional', 'feature/additional'])

    session.rebuild.mockResolvedValue(withPrelude('blue'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(scopes.map(boot)).toEqual(['additional', 'feature/additional'])
    expect(published.get(contentFile)).toMatchObject({ source: '<view data-color="blue"></view>' })

    harness.nativeOutput = nativeOutput('rebuilt')
    await session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(scopes.map(boot)).toEqual(['rebuilt', 'feature/rebuilt'])
  })

  it('keeps an older native full output on the adopted snapshot while draining before the new batch', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    harness.beforeFullPrepare.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput(appOutput(), 'full')
    })
    await session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().filter(item => item.fileName === contentFile).map(item => item.source)).toEqual([
      '<view data-color="red"></view>',
      '<view data-color="blue"></view>',
    ])
  })

  it('does not acknowledge a full batch from additional chunks and replays its unpublished snapshot', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput([{ type: 'chunk', fileName: 'pages/index.js', code: 'Page({})', modules: {} }], 'additional')
    })
    await session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().some(item => item.fileName === contentFile)).toBe(false)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: contentFile, source: '<view data-color="blue"></view>' })
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
    await session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().some(item => item.fileName === contentFile)).toBe(false)
    gate.resolve()
    await vi.advanceTimersByTimeAsync(1)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: contentFile, source: '<view data-color="blue"></view>' })
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
    await session.full()
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
      fileName: pageContentFile,
      source: expect.stringContaining('<view data-color="red"></view>'),
    })
    expect(commit).toHaveBeenCalledTimes(1)

    harness.writeOutput.mockClear()
    await session.full()
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

  it('publishes initial inherited styles and hands an isolation change to classic before clearing them', async () => {
    const initial = { ...compiledStylesheetSnapshot('red'), componentPageGlobalStyleRoutes: [route] }
    const session = await start(initial)
    session.classic.mockImplementation(async () => {
      await session.close()
      session.runtime.markClassic()
    })
    expect(writtenAssets()).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.stylesheet { color: red; }'),
    })
    harness.writeOutput.mockClear()
    session.rebuild.mockResolvedValue(compiledStylesheetSnapshot('red'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    await expect(session.runtime.whenSettled()).resolves.toBeUndefined()
    expect(session.runtime.phase).toBe('classic')
    expect(session.runtime.fallback).toMatchObject({ code: 'stylesheet-output', files: [`${route}.wxss`] })
    expect(session.classic).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it('does not retire native-owned preludes missing from an asset refresh', async () => {
    const initial = snapshot('red', [])
    initial.output.push(
      { type: 'asset', fileName: 'app.prelude.js', source: 'native prelude' },
      { type: 'asset', fileName: 'package/app.prelude.js', source: 'native package prelude' },
    )
    const session = await start(initial)
    session.rebuild.mockResolvedValue(snapshot('red', []))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    const retired = harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])
    expect(retired).not.toContain('app.prelude.js')
    expect(retired).not.toContain('package/app.prelude.js')
  })

  it('does not retire native-owned preludes omitted from a later full output', async () => {
    harness.nativeOutput = [{ type: 'asset', fileName: 'app.prelude.js', source: 'native prelude' }]
    const session = await start(snapshot('red'))
    await session.full()
    await vi.advanceTimersByTimeAsync(50)

    harness.nativeOutput = []
    harness.writeOutput.mockClear()
    await session.full()
    await vi.advanceTimersByTimeAsync(50)

    const retired = harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])
    expect(retired).not.toContain('app.prelude.js')
  })

  it('retires copied assets and republishes identical bytes after restoration', async () => {
    const copied = { type: 'asset' as const, fileName: 'resources/copied.txt', source: 'original' }
    const initial = snapshot('red', [])
    initial.output.push(copied)
    const session = await start(initial)
    session.rebuild.mockResolvedValue(snapshot('red', []))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.at(-1)?.[3]).toContain(copied.fileName)
    session.rebuild.mockResolvedValue(initial)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(copied)
  })

  it('refreshes public assets from filesystem changes using the resolved public directory', async () => {
    vi.useRealTimers()
    const publicRoot = path.join(root, 'static-assets')
    await mkdir(publicRoot, { recursive: true })
    const directory = await mkdtemp(path.join(publicRoot, 'watch-lifecycle-'))
    temporaryDirectories.push(directory)
    const source = path.join(directory, 'config.js')
    const fileName = path.relative(publicRoot, source)
    const publicAsset = { type: 'asset' as const, fileName, source: 'original' }
    await writeFile(source, publicAsset.source)
    const initial = snapshot('red', [])
    initial.output.push(publicAsset)
    const session = await start(initial)
    session.rebuild.mockImplementation(async () => {
      const next = snapshot('red', [])
      const content = await readFile(source, 'utf8').catch(() => undefined)
      if (content !== undefined) {
        next.output.push({ ...publicAsset, source: content })
      }
      return next
    })
    for (const content of ['updated', undefined, 'original']) {
      harness.writeOutput.mockClear()
      if (content === undefined) {
        await rm(source)
        await vi.waitFor(() => expect(harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])).toContain(fileName))
      }
      else {
        await writeFile(source, content)
        await vi.waitFor(() => expect(writtenAssets()).toContainEqual({ ...publicAsset, source: content }))
      }
    }
    expect(session.rebuild).toHaveBeenCalledWith([source])
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('restores original bytes when deletion is superseded during native write', async () => {
    const copied = { type: 'asset' as const, fileName: 'resources/copied.txt', source: 'original' }
    const initial = snapshot('red', [])
    initial.output.push(copied)
    const session = await start(initial)
    session.rebuild.mockResolvedValueOnce(snapshot('red', [])).mockResolvedValue(initial)
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => blocked.promise)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.at(-1)?.[3]).toContain(copied.fileName)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(copied)
  })

  it.each(['refresh', 'full'] as const)('retires newly written assets from a failed %s when the next snapshot omits them', async (mode) => {
    const initial = snapshot('red', [])
    const added = { type: 'asset' as const, fileName: 'resources/transient.txt', source: 'partial write' }
    const failed = snapshot('red', [])
    failed.output.push(added)
    const session = await start(initial)
    session.rebuild.mockResolvedValueOnce(failed).mockResolvedValue(initial)
    const failure = new Error('write failed after adding a file')
    harness.writeOutput.mockClear().mockRejectedValueOnce(failure)
    await session[mode]()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(added)
    await expect(session.whenSettled()).rejects.toBe(failure)
    harness.writeOutput.mockClear()
    // 完整快照失败后客户端已暂停；真实源码保存才会重新调度完整构建。
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    await session.whenSettled()
    expect(harness.writeOutput.mock.calls.at(-1)?.[3]).toContain(added.fileName)
  })

  it('rewrites original bytes after a deletion write reports partial failure', async () => {
    const copied = { type: 'asset' as const, fileName: 'resources/copied.txt', source: 'original' }
    const initial = snapshot('red', [])
    initial.output.push(copied)
    const session = await start(initial)
    session.rebuild.mockResolvedValueOnce(snapshot('red', [])).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('partial deletion failed'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(copied)
  })

  it('retries the complete asset diff after a failed refresh instead of adopting unwritten assets', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('simulated write failure'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: contentFile, source: '<view data-color="blue"></view>' },
      { type: 'asset', fileName: pageContentFile, source: expect.stringContaining('<view data-color="blue"></view>') },
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
    expect(writtenAssets().filter(item => item.fileName === contentFile)).toEqual([
      { type: 'asset', fileName: contentFile, source: '<view data-color="blue"></view>' },
    ])
    expect(writtenAssets()).toContainEqual({
      type: 'asset',
      fileName: pageContentFile,
      source: expect.stringContaining('<view data-color="blue"></view>'),
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
    await session.full()
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
      path.join(root, 'src/page.wxss'),
    ])
    expect(commit).toHaveBeenCalledTimes(2)
    expect(writtenAssets()).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: contentFile, source: '<view data-color="blue"></view>' },
      { type: 'asset', fileName: pageContentFile, source: '' },
    ]))
  })

  it('retains a full batch when the adapter finishes without delivering output', async () => {
    const session = await start()
    harness.writeOutput.mockClear()
    harness.fullBuild.mockResolvedValueOnce(undefined)
    await session.full()
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
    await session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(writtenAssets().filter(item => item.fileName === contentFile)).toEqual([
      { type: 'asset', fileName: contentFile, source: '<view data-color="green"></view>' },
    ])
    expect(writtenAssets().filter(item => item.fileName === pageContentFile)).toEqual([
      { type: 'asset', fileName: pageContentFile, source: expect.stringContaining('<view data-color="green"></view>') },
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
