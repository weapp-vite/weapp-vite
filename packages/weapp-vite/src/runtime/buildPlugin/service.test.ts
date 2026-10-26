import type { OutputBundle, OutputChunk, RolldownOutput, RolldownWatcher } from 'rolldown'
import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { GlassEaselAnalysisFact } from '../../analyze/glassEasel/types'
import type { HmrProfileJsonSample } from '../../analyze/hmr'
import type { CompilerContext } from '../../context'
import type { CorePluginState } from '../../plugins/core/helpers'
import type { DevBuildWatcherController } from './devBuildWatcher'
import { EventEmitter } from 'node:events'
import { realpathSync } from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { attachDevModuleGraphHost } from '../../moduleGraph/host'
import { createModuleGraphService } from '../../moduleGraph/service'
import { getSupportedMiniProgramPlatforms } from '../../platform'
import { createCompilerContentSourceOwner } from '../../plugins/compilerPlugin/contentSources'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { createGenerateBundleHook } from '../../plugins/core/lifecycle/emit/generate'
import { captureIndependentOutputFileNames } from '../../plugins/outputFinalizer/independent'
import { registerManagedTailwindcssEntries } from '../../plugins/tailwindcssMarker'
import { readCompilerInput, withCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'

import { publishAutoRoutesTopology, registerAutoRoutesTopologySource } from '../autoRoutesPlugin/topology'
import { HmrRuntimeCapabilityError } from '../hmrRuntimeCapabilities'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { beginHmrStyleUpdatePlan, getHmrStyleUpdatePlan, recordHmrStyleUpdate } from '../hmrStyleUpdate'
import { resetRuntimeStateForFreshBuild } from '../resetRuntimeState'
import { createRuntimeState } from '../runtimeState'
import { StatefulHmrRuntimeCompatibilityError } from '../statefulHmr/commonRuntime'
import { offerStatefulHmrSnapshot, StatefulHmrSnapshotHandoff } from '../statefulHmr/snapshotHandoff'
import { storeVueSfcHmrSignatures } from '../storeVueSfcHmrSignatures'
import { ownsSidecarDelivery } from '../watch/sidecarDelivery'
import { createWatcherServicePlugin } from '../watcherPlugin'
import { getInitialBuildInputObservation, startInitialBuildInputObservation } from './initialBuildChanges'
import { createBuildService } from './service'

const ALL_MP_PLATFORMS = [...getSupportedMiniProgramPlatforms()]

const buildMock = vi.hoisted(() => vi.fn())
const vueStyleSnapshotMock = vi.hoisted(() => vi.fn<typeof import('./vueStyleSnapshot').withVueStyleDependencySnapshot>())
const cleanOutputsMock = vi.hoisted(() => vi.fn(async () => {}))
const resetEmittedOutputCachesMock = vi.hoisted(() => vi.fn())
const isOutputRootInsideOutDirMock = vi.hoisted(() => vi.fn((outDir: string, pluginOutputRoot: string) => {
  return pluginOutputRoot === outDir || pluginOutputRoot.startsWith(`${outDir}/`)
}))
const createPluginProjectSessionMock = vi.hoisted(() => vi.fn(async () => ({
  context: { buildService: { build: vi.fn(async () => ({ output: [] })) } },
  run: async (task: () => Promise<unknown>) => await task(),
  close: vi.fn(async () => {}),
})))
const setPluginProjectBuildOptionsMock = vi.hoisted(() => vi.fn())
const disableProjectPrivateConfigHotReloadMock = vi.hoisted(() => vi.fn(async () => true))
const prepareClassicIdeConfigMock = vi.hoisted(() => vi.fn<typeof import('../classicIdeConfig/prepare').prepareClassicIdeConfig>(async () => {}))
const syncProjectConfigToOutputMock = vi.hoisted(() => vi.fn(async () => {}))
const generateLibDtsMock = vi.hoisted(() => vi.fn(async () => {}))
const createSharedBuildConfigMock = vi.hoisted(() => vi.fn(() => ({ shared: true })))
const touchMock = vi.hoisted(() => vi.fn(async () => {}))
const touchOutputStylesMock = vi.hoisted(() => vi.fn(async () => new Set<string>()))
const checkWorkersOptionsMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const independentBuildMock = vi.hoisted(() => vi.fn(async () => ({ output: [] })))
const independentGetOutputMock = vi.hoisted(() => vi.fn(() => undefined))
const independentInvalidateMock = vi.hoisted(() => vi.fn())
const createIndependentBuilderMock = vi.hoisted(() => vi.fn(() => ({
  buildIndependentBundle: independentBuildMock,
  getIndependentOutput: independentGetOutputMock,
  invalidateIndependentOutput: independentInvalidateMock,
})))
const appendFileMock = vi.hoisted(() => vi.fn(async () => {}))
const mkdirMock = vi.hoisted(() => vi.fn(async () => {}))
const watchAssetSourcesMock = vi.hoisted(() => vi.fn((_config: unknown, _options: Parameters<typeof import('../watch/assets').watchAssetSources>[1]) => ({
  ready: Promise.resolve(),
  close: vi.fn(async () => {}),
})))
const chokidarWatchMock = vi.hoisted(() => vi.fn(() => ({
  add: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
})))
const syncProjectSupportFilesMock = vi.hoisted(() => vi.fn(async () => ({
  managedTsconfigChanged: false,
  managedTsconfigWarnings: [],
})))
const runStatefulHmrDevMock = vi.hoisted(() => vi.fn())
const prepareStatefulClassicHandoffMock = vi.hoisted(() => vi.fn())
const createStatefulHmrSnapshotOptionsMock = vi.hoisted(() => vi.fn(async (_options: unknown) => ({
  options: { build: {}, plugins: [] as Plugin[] },
  getGlobalStyleRoutes: () => [],
  getChildSources: () => ({ files: [], roots: [] }),
  getTailwindStyleOwners: () => new Map(),
  getGlassEaselAnalysisByOwner: () => new Map<string, GlassEaselAnalysisFact>(),
  getTemplateRegistrationSignatures: () => new Map<string, string>(),
  getEntryIds: () => new Set<string>(),
  getDelegatedComponentEntryIds: () => new Set<string>(),
})))
const devBuildWatcherQueue = vi.hoisted(() => [] as Array<{
  watcher: any
  emitEvent: ReturnType<typeof vi.fn>
}>)
const createDevBuildWatcherMock = vi.hoisted(() => vi.fn(() => {
  const queued = devBuildWatcherQueue.shift()
  if (queued) {
    return queued
  }
  const watcher = {
    on: vi.fn(() => watcher),
    off: vi.fn(() => watcher),
    clear: vi.fn(),
    close: vi.fn(async () => {}),
  }
  return { watcher, emitEvent: vi.fn() }
}))
const moduleGraphProviderChange = vi.hoisted(() => ({
  handler: undefined as undefined | ((change: { event: 'create' | 'update' | 'delete', file: string }) => void),
}))
const createDevModuleGraphProviderMock = vi.hoisted(() => vi.fn(async (_ctx, _config, onChange) => {
  moduleGraphProviderChange.handler = onChange
  return { close: vi.fn(async () => {}) }
}))

vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  appendFile: appendFileMock,
  mkdir: mkdirMock,
}))

vi.mock('./vueStyleSnapshot', () => ({ withVueStyleDependencySnapshot: vueStyleSnapshotMock }))

vi.mock('vite', () => ({
  build: buildMock,
}))

vi.mock('../watch/assets', () => ({ watchAssetSources: watchAssetSourcesMock }))

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarWatchMock,
  },
}))

vi.mock('./outputs', async importOriginal => ({
  ...await importOriginal<typeof import('./outputs')>(),
  cleanOutputs: cleanOutputsMock,
  isOutputRootInsideOutDir: isOutputRootInsideOutDirMock,
  resetEmittedOutputCaches: resetEmittedOutputCachesMock,
}))

vi.mock('./pluginProject', () => ({
  createPluginProjectSession: createPluginProjectSessionMock,
  isPluginProjectClosing: () => false,
  runPluginProjectRestart: (_ctx: unknown, run: () => Promise<void>) => run(),
  setPluginProjectBuildOptions: setPluginProjectBuildOptionsMock,
  assertPluginProjectOutput: vi.fn(),
}))

vi.mock('../../utils/projectConfig', () => ({
  disableProjectPrivateConfigHotReload: disableProjectPrivateConfigHotReloadMock,
  syncProjectConfigToOutput: syncProjectConfigToOutputMock,
}))

// 本套件验证构建编排；真实配置租约和请求视图由 classicIdeConfig 套件覆盖。
vi.mock('../classicIdeConfig/prepare', () => ({ prepareClassicIdeConfig: prepareClassicIdeConfigMock }))

vi.mock('../supportFiles', () => ({
  syncProjectSupportFiles: syncProjectSupportFilesMock,
}))

vi.mock('../statefulHmr/session', () => ({
  prepareStatefulClassicHandoff: prepareStatefulClassicHandoffMock,
  runStatefulHmrDev: runStatefulHmrDevMock,
}))

vi.mock('../statefulHmr/snapshotBuild', async importOriginal => ({
  ...await importOriginal<typeof import('../statefulHmr/snapshotBuild')>(),
  buildStatefulHmrSnapshot: async (loadOptions: unknown, configure: (options: InlineConfig) => InlineConfig) => {
    const snapshot = await createStatefulHmrSnapshotOptionsMock(loadOptions)
    const options = configure(snapshot.options)
    options.build = { ...options.build, watch: undefined, write: false }
    return { ...snapshot, output: await buildMock(options) }
  },
}))

vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: createDevModuleGraphProviderMock,
}))

vi.mock('./devBuildWatcher', () => ({
  createDevBuildWatcher: createDevBuildWatcherMock,
}))

vi.mock('../libDts', () => ({
  generateLibDts: generateLibDtsMock,
}))

vi.mock('../sharedBuildConfig', () => ({
  createSharedBuildConfig: createSharedBuildConfigMock,
}))

vi.mock('./touchAppWxss', async importOriginal => ({
  ...await importOriginal<typeof import('./touchAppWxss')>(),
  touchExistingAppStyle: touchMock,
  touchExistingOutputStyles: touchOutputStylesMock,
}))

vi.mock('./workers', () => ({
  checkWorkersOptions: checkWorkersOptionsMock,
}))

vi.mock('../../context/shared', () => ({
  debug: vi.fn(),
  logger: {
    error: loggerErrorMock,
    info: loggerInfoMock,
    success: loggerSuccessMock,
    warn: loggerWarnMock,
  },
}))

vi.mock('./independent', () => ({
  createIndependentBuilder: createIndependentBuilderMock,
}))

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_VITEST = process.env.VITEST
const ORIGINAL_HMR_PROFILE_JSON = process.env.WEAPP_VITE_HMR_PROFILE_JSON

function createWatcher(eventCodes: string[]) {
  const watcher: any = {
    on: vi.fn((event: string, callback: (payload: { code: string }) => void) => {
      if (event === 'event') {
        queueMicrotask(() => {
          for (const code of eventCodes) {
            callback({ code })
          }
        })
      }
      return watcher
    }),
    close: vi.fn(),
  }
  return watcher
}

function createManualWatcher() {
  let eventCallback: ((payload: { code: string }) => void) | undefined
  let resolveSubscribed: (() => void) | undefined
  const subscribed = new Promise<void>((resolve) => {
    resolveSubscribed = resolve
  })
  const watcher: any = {
    on: vi.fn((event: string, callback: (payload: { code: string }) => void) => {
      if (event === 'event') {
        eventCallback = callback
        resolveSubscribed?.()
      }
      return watcher
    }),
    emit(code: string) {
      eventCallback?.({ code })
    },
    emitPayload(payload: { code: string, [key: string]: any }) {
      eventCallback?.(payload)
    },
    subscribed,
    close: vi.fn(),
  }
  devBuildWatcherQueue.push({
    watcher,
    emitEvent: vi.fn(event => watcher.emitPayload(event)),
  })
  return watcher
}

function createManualSidecarWatcher() {
  let allCallback: ((event: string, id?: string) => void) | undefined
  const watcher: any = {
    add: vi.fn(),
    unwatch: vi.fn(async () => {}),
    on: vi.fn((event: string, callback: (event: string, id?: string) => void) => {
      if (event === 'all') {
        allCallback = callback
      }
      return watcher
    }),
    emit(event: string, id?: string) {
      allCallback?.(event, id)
    },
    close: vi.fn(),
  }
  return watcher
}

function createScanningSidecarWatcher() {
  const watcher = createManualSidecarWatcher()
  const readiness = new EventEmitter()
  watcher.once = vi.fn(readiness.once.bind(readiness))
  watcher.off = vi.fn(readiness.off.bind(readiness))
  watcher.ready = () => readiness.emit('ready')
  return watcher
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  const runtimeState = createRuntimeState()
  const rollupWatcherMap = new Map()
  const sidecarWatcherMap = new Map()
  const ctx = {
    runtimeState,
    configService: {
      inlineConfig: {},
      weappViteConfig: {},
      weappLibConfig: undefined,
      loadOptions: {
        cwd: '/project',
        isDev: true,
        mode: 'development',
      },
      load: vi.fn(async () => {}),
      merge: vi.fn((_meta: any, _inline: any, next: any) => next ?? {}),
      outDir: '/project/dist',
      outputExtensions: { wxss: 'wxss' },
      absolutePluginRoot: undefined,
      absoluteSrcRoot: '/project/src',
      relativeAbsoluteSrcRoot: vi.fn((id: string) => id.replace('/project/src/', '')),
      relativeOutputPath: vi.fn((id: string) => id.replace('/project/src/', '')),
      relativeCwd: vi.fn((id: string) => id.replace('/project/', '')),
      platform: 'weapp',
      multiPlatform: {
        enabled: false,
        projectConfigRoot: 'config',
        targets: ALL_MP_PLATFORMS,
      },
      packageJson: {},
      cwd: '/project',
      projectConfigPath: '/project/project.config.json',
      projectPrivateConfig: {},
      projectPrivateConfigPath: '/project/project.private.config.json',
      isDev: true,
      configFileDependencies: [],
    },
    watcherService: {
      rollupWatcherMap,
      sidecarWatcherMap,
      closeAll: vi.fn(async () => {}),
      setRollupWatcher: vi.fn((watcher: any, root: string = '/') => {
        rollupWatcherMap.set(root, watcher)
      }),
    },
    npmService: {
      build: vi.fn(async () => {}),
      checkDependenciesCacheOutdate: vi.fn(async () => true),
    },
    scanService: {
      subPackageMap: new Map(),
      workersDir: undefined,
      markDirty: vi.fn(),
      loadAppEntry: vi.fn(async () => {}),
      loadSubPackages: vi.fn(() => []),
      drainIndependentDirtyRoots: vi.fn(() => []),
    },
    moduleGraphService: {
      bindBuildContext: vi.fn(),
      bindPluginContext: vi.fn(),
      clearPendingChanges: vi.fn(),
      resetSession: vi.fn(),
      removeEntryDependencies: vi.fn(),
      collectAffectedEntries: vi.fn(() => new Set<string>()),
      hasModule: vi.fn(() => true),
      isLogicalLayoutEntry: vi.fn(() => false),
      recordChangedFile: vi.fn(),
    },
  } as any

  if (Object.keys(overrides).length > 0) {
    Object.assign(ctx, overrides)
  }

  return ctx
}

const HMR_PAGE_ID = '/project/src/pages/logs/index.ts'
const HMR_OTHER_PAGE_ID = '/project/src/pages/about/index.ts'
const HMR_INCREMENTAL_OUTPUTS = ['pages/logs/index.js', 'pages/logs/index.wxml']
const HMR_FULL_OUTPUTS = [...HMR_INCREMENTAL_OUTPUTS, 'shared-dependency.js', 'shared-logic.js']
// 此处只观察 core generate：classic 元数据批次保留原生脚本供最终转换。
// 无变化最终产物的去重由 outputFinalizer/classicPublication.test.ts 覆盖。
const HMR_METADATA_CORE_OUTPUTS = HMR_FULL_OUTPUTS

const runVueStyleSnapshotMock: typeof import('./vueStyleSnapshot').withVueStyleDependencySnapshot = async (ctx, _entries, _files, run, _onDrift, preparation) => {
  if (!preparation) {
    return await run()
  }
  const inputs = new Set([...preparation.entries, ...(preparation.inputs ?? [])])
  const sources = new Map(await Promise.all(Array.from(inputs, async entry => [entry, await fs.readFile(entry, 'utf8')] as const)))
  return await withCompilerSourceSnapshot(ctx.configService, sources, async () => {
    await preparation.resolveAffectedEntries()
    return await run()
  })
}

async function createAppShellSnapshotHarness(before: boolean | undefined, duringInitialBuild?: (ctx: CompilerContext, appId: string) => Promise<void>) {
  const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-app-shell-snapshot-'))))
  const appId = path.join(root, 'app.vue')
  const pageIds = ['first.vue', 'second.vue'].map(name => path.join(root, 'pages', name))
  const componentId = path.join(root, 'components/plain.vue')
  const appSource = (hasTemplate: boolean) => `<script setup>const marker = 'app'</script>${hasTemplate ? '<template><view><slot /></view></template>' : ''}`
  const watcher = createManualWatcher()
  const ctx = createMockContext()
  await fs.outputFile(appId, appSource(before ?? false))
  for (const id of [...pageIds, componentId]) {
    await fs.outputFile(id, '<template><view>unchanged</view></template>')
  }
  Object.assign(ctx.configService, {
    cwd: root,
    absoluteSrcRoot: root,
    outDir: path.join(root, 'dist'),
    relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
  })
  ctx.scanService.appEntry = { path: appId }
  if (before !== undefined) {
    ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, before)
  }
  else {
    // 模拟首构预捕获解析失败、交回原生构建诊断的路径，保留未知代际的契约。
    vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run) => await run({ forceFullRescan: true }))
  }
  const allIds = [appId, ...pageIds, componentId]
  for (const id of allIds) {
    expect(compilerSourceId(id)).toBe(id)
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(id, { id })
    ctx.runtimeState.build.hmr.loadedEntrySet.add(id)
  }
  for (const id of pageIds) {
    ctx.runtimeState.build.hmr.entriesMap.set(id, { path: id, type: 'page' })
  }
  ctx.runtimeState.build.hmr.entriesMap.set(componentId, { path: componentId, type: 'component' })
  ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([appId]))
  buildMock.mockImplementationOnce(async () => {
    await duringInitialBuild?.(ctx, appId)
    return watcher
  }).mockResolvedValue({ output: [] })
  const firstBuild = createBuildService(ctx).build({ skipNpm: true })
  await watcher.subscribed
  watcher.emit('START')
  watcher.emit('END')
  await firstBuild
  const events = createDevBuildWatcherMock.mock.results.at(-1)!.value.emitEvent
  return {
    appId,
    appSource,
    pageIds,
    componentId,
    ctx,
    consumeDirtyEntries() {
      ctx.runtimeState.build.hmr.dirtyEntrySet.clear()
      ctx.runtimeState.build.hmr.dirtyEntryReasons.clear()
      ctx.runtimeState.build.hmr.dirtyVueEntryIds.clear()
      for (const id of allIds) {
        ctx.runtimeState.build.hmr.loadedEntrySet.add(id)
      }
    },
    async update(source: string, changedFile = appId) {
      const settledEvents = () => events.mock.calls.filter(([event]) => event.code === 'END' || event.code === 'ERROR').length
      const before = settledEvents()
      await fs.writeFile(appId, source)
      moduleGraphProviderChange.handler!({ event: 'update', file: changedFile })
      await vi.waitFor(() => expect(settledEvents()).toBe(before + 1))
    },
    async close() {
      await watcher.close()
      await fs.remove(root)
    },
  }
}

async function emitSharedChunkSnapshot(
  ctx: CompilerContext,
  options: { metadataOnly?: boolean, affectedSharedChunks?: boolean } = {},
): Promise<string[]> {
  const sharedChunkIds = ['shared-logic.js', 'shared-dependency.js']
  // 旧图包含另一个页面；完整 snapshot 重建图，增量构建必须保留未参与页面的边。
  const state = {
    ctx,
    entriesMap: new Map(),
    resolvedEntryMap: new Map([
      [HMR_PAGE_ID, { id: HMR_PAGE_ID }],
      [HMR_OTHER_PAGE_ID, { id: HMR_OTHER_PAGE_ID }],
    ]),
    hmrState: {
      hasBuiltOnce: true,
      didEmitAllEntries: false,
      lastEmittedEntryIds: new Set([HMR_PAGE_ID]),
      skipSharedChunkRefresh: options.metadataOnly,
      affectedSharedChunkIds: new Set(options.affectedSharedChunks ? sharedChunkIds : []),
    },
    hmrSharedChunksMode: 'auto',
    hmrSharedChunkImporters: new Map(sharedChunkIds.map(id => [id, new Set([HMR_PAGE_ID, HMR_OTHER_PAGE_ID])])),
    hmrSharedChunksByEntry: new Map([
      [HMR_PAGE_ID, new Set(sharedChunkIds)],
      [HMR_OTHER_PAGE_ID, new Set(sharedChunkIds)],
    ]),
    hmrSharedChunkDependencies: new Map([['shared-logic.js', new Set(['shared-dependency.js'])]]),
    outputChunksByModule: new Map(),
    hmrSourceSharedChunks: new Set(),
    watchFilesSnapshot: [],
  } as CorePluginState
  const chunk = (fileName: string, code: string, imports: string[], facadeModuleId: string | null = null): OutputChunk => ({
    type: 'chunk',
    fileName,
    code,
    imports,
    dynamicImports: [],
    facadeModuleId,
    isEntry: facadeModuleId !== null,
    moduleIds: facadeModuleId ? [facadeModuleId] : [],
    modules: {},
    exports: ['value'],
    map: null,
  } as OutputChunk)
  const bundle: OutputBundle = {
    'pages/logs/index.js': chunk('pages/logs/index.js', 'exports.value = require("../../shared-logic.js").value', ['../../shared-logic.js'], HMR_PAGE_ID),
    'shared-logic.js': chunk('shared-logic.js', 'exports.value = require("./shared-dependency.js").value', ['./shared-dependency.js']),
    'shared-dependency.js': chunk('shared-dependency.js', 'exports.value = 42', []),
    'pages/logs/index.wxml': {
      type: 'asset',
      fileName: 'pages/logs/index.wxml',
      names: [],
      originalFileNames: [],
      source: '<view>updated</view>',
    },
  }
  ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.clear()
  ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add('pages/logs/index.js')
  await createGenerateBundleHook(state, false).call({}, {}, bundle)
  return Object.keys(bundle).sort()
}

/** 一次物理保存会分别通知 Vite 与 Chokidar，由真实控制器决定唯一交付方。 */
function createSourceChangeEmitter() {
  const providerChange = moduleGraphProviderChange.handler
  const sidecar = chokidarWatchMock.mock.results.at(-1)?.value
  const watched = chokidarWatchMock.mock.calls.at(-1)?.[0]
  const roots = (Array.isArray(watched) ? watched : [watched]).filter((root): root is string => typeof root === 'string')
  return (change: { event: 'create' | 'update' | 'delete', file: string }) => {
    providerChange?.(change)
    if (roots.some(root => change.file === root || change.file.startsWith(`${root}/`))) {
      sidecar?.emit?.(change.event === 'create' ? 'add' : change.event === 'delete' ? 'unlink' : 'change', change.file)
    }
  }
}

function emitSourceChange(change: { event: 'create' | 'update' | 'delete', file: string }) {
  createSourceChangeEmitter()(change)
}

async function startClassicSnapshotContext() {
  const watcher = createManualWatcher()
  const sidecarWatcher = createManualSidecarWatcher()
  const ctx = createMockContext()
  ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
  ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
  chokidarWatchMock.mockReturnValueOnce(sidecarWatcher)
  buildMock.mockResolvedValueOnce({ output: [] })
  const firstBuild = createBuildService(ctx).build({ skipNpm: true })
  await watcher.subscribed
  watcher.emit('START')
  watcher.emit('END')
  await firstBuild
  const onChange = moduleGraphProviderChange.handler
  if (!onChange) {
    throw new Error('Classic HMR graph provider did not subscribe')
  }
  return { ctx, watcher, onChange: createSourceChangeEmitter(), onProviderChange: onChange }
}

async function flushAsyncTasks() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve()
  }
}

async function waitForTimers(ms = 12) {
  await new Promise(resolve => setTimeout(resolve, ms))
  await flushAsyncTasks()
}

async function waitForMockCalls(mock: { mock: { calls: unknown[] } }, count: number) {
  for (let index = 0; index < 20; index += 1) {
    if (mock.mock.calls.length >= count) {
      return
    }
    await flushAsyncTasks()
    await waitForTimers()
  }
}

describe('runtime buildPlugin service', () => {
  it('waits for npm output work before propagating a failed production build', async () => {
    const ctx = createMockContext()
    ctx.configService.isDev = false
    let finishNpm!: () => void
    const pendingNpm = new Promise<void>((resolve) => {
      finishNpm = resolve
    })
    ctx.npmService.build.mockReturnValue(pendingNpm)
    const error = new Error('main build failed')
    buildMock.mockRejectedValue(error)
    const service = createBuildService(ctx)
    let settled = false
    const result = service.build().finally(() => {
      settled = true
    })
    const rejected = expect(result).rejects.toBe(error)
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(ctx.npmService.build).toHaveBeenCalledOnce()
    expect(settled).toBe(false)
    finishNpm()
    await rejected
    expect(settled).toBe(true)
  })

  it('propagates a worker publication failure from the main build transaction', async () => {
    const ctx = createMockContext()
    ctx.configService.isDev = false
    checkWorkersOptionsMock.mockReturnValue({ hasWorkersDir: true, workersDir: 'workers' })
    const error = new Error('worker publication failed')
    buildMock.mockRejectedValueOnce(error)
    await expect(createBuildService(ctx).build({ skipNpm: true })).rejects.toBe(error)
    expect(buildMock).toHaveBeenCalledOnce()
  })

  beforeEach(() => {
    devBuildWatcherQueue.length = 0
    vi.clearAllMocks()
    buildMock.mockReset()
    vueStyleSnapshotMock.mockReset().mockImplementation(runVueStyleSnapshotMock)
    disableProjectPrivateConfigHotReloadMock.mockReset()
    disableProjectPrivateConfigHotReloadMock.mockResolvedValue(true)
    runStatefulHmrDevMock.mockReset()
    createStatefulHmrSnapshotOptionsMock.mockReset().mockImplementation(async () => ({
      options: { build: {}, plugins: [] },
      getGlobalStyleRoutes: () => [],
      getChildSources: () => ({ files: [], roots: [] }),
      getTailwindStyleOwners: () => new Map(),
      getGlassEaselAnalysisByOwner: () => new Map<string, GlassEaselAnalysisFact>(),
      getTemplateRegistrationSignatures: () => new Map<string, string>(),
      getEntryIds: () => new Set<string>(),
      getDelegatedComponentEntryIds: () => new Set<string>(),
    }))
    resetEmittedOutputCachesMock.mockReset()
    isOutputRootInsideOutDirMock.mockImplementation((outDir: string, pluginOutputRoot: string) => {
      return pluginOutputRoot === outDir || pluginOutputRoot.startsWith(`${outDir}/`)
    })
    process.env.VITEST = 'true'
    process.env.NODE_ENV = 'test'
    checkWorkersOptionsMock.mockReturnValue({
      hasWorkersDir: false,
      workersDir: undefined,
    })
    syncProjectSupportFilesMock.mockResolvedValue({
      managedTsconfigChanged: false,
      managedTsconfigWarnings: [],
    })
    chokidarWatchMock.mockClear()
    delete process.env.WEAPP_VITE_HMR_PROFILE_JSON
  })

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    }
    else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV
    }
    if (ORIGINAL_VITEST === undefined) {
      delete process.env.VITEST
    }
    else {
      process.env.VITEST = ORIGINAL_VITEST
    }
    if (ORIGINAL_HMR_PROFILE_JSON === undefined) {
      delete process.env.WEAPP_VITE_HMR_PROFILE_JSON
    }
    else {
      process.env.WEAPP_VITE_HMR_PROFILE_JSON = ORIGINAL_HMR_PROFILE_JSON
    }
  })

  it('throws when required runtime services are missing', () => {
    const runtimeState = createRuntimeState()

    expect(() => createBuildService({ runtimeState } as any)).toThrow('构建服务需要先初始化 config、watcher、npm 和 scan 服务。')
  })

  it('holds real classic controller resources across snapshots and failure until pending work finishes on close', async () => {
    const { createDevBuildWatcher } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controller = createDevBuildWatcher()
    devBuildWatcherQueue.push(controller as any)
    const ctx = createMockContext()
    const plugin = createWatcherServicePlugin(ctx)
    const sidecarClose = vi.fn(async () => {})
    let failure = false
    let pending: Promise<void> | undefined
    buildMock.mockImplementation(async () => {
      await pending
      plugin.configResolved?.({ command: 'build', build: {} } as any)
      if (failure) {
        await plugin.buildEnd?.(new Error('recoverable snapshot error'))
      }
      await plugin.closeBundle?.()
      if (failure) {
        throw new Error('recoverable snapshot error')
      }
      return { output: [] }
    })
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as typeof controller.watcher
    ctx.watcherService.sidecarWatcherMap.set('auto-import', { close: sidecarClose })
    const change = () => moduleGraphProviderChange.handler!({ event: 'update', file: '/project/src/pages/index.ts' })
    change()
    await waitForMockCalls(buildMock, 2)
    expect(sidecarClose).not.toHaveBeenCalled()
    failure = true
    change()
    await waitForMockCalls(buildMock, 3)
    await waitForMockCalls(loggerErrorMock, 1)
    expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(watcher)
    expect(sidecarClose).not.toHaveBeenCalled()
    failure = false
    let finish!: () => void
    pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    change()
    await waitForMockCalls(buildMock, 4)
    let closed = false
    const close = Promise.resolve(watcher.close()).then(() => {
      closed = true
    })
    await flushAsyncTasks()
    expect(closed).toBe(false)
    expect(sidecarClose).not.toHaveBeenCalled()
    finish()
    await close
    expect(sidecarClose).toHaveBeenCalledTimes(1)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
  })

  it('releases classic resources after publication failure even when the graph provider cannot close', async () => {
    const ctx = createMockContext()
    const plugin = createWatcherServicePlugin(ctx)
    const sidecarClose = vi.fn(async () => {})
    ctx.watcherService.sidecarWatcherMap.set('auto-import', { close: sidecarClose })
    const startupError = new Error('publication startup failed')
    const closeError = new Error('graph close failed')
    createDevModuleGraphProviderMock.mockResolvedValueOnce({ close: vi.fn(async () => {
      throw closeError
    }) })
    buildMock.mockImplementation(async () => {
      plugin.configResolved?.({ command: 'build', build: {} } as any)
      await plugin.buildEnd?.(startupError)
      throw startupError
    })
    await expect(createBuildService(ctx).build({ skipNpm: true })).rejects.toMatchObject({
      errors: [startupError, closeError],
    })
    expect(sidecarClose).toHaveBeenCalledTimes(1)
    const laterClose = vi.fn(async () => {})
    ctx.watcherService.sidecarWatcherMap.set('later-build', { close: laterClose })
    plugin.configResolved?.({ command: 'build', build: {} } as any)
    // 同一 service 保留上轮关闭错误，但仍须释放之后登记的资源。
    await expect(plugin.closeBundle?.()).rejects.toBe(closeError)
    expect(laterClose).toHaveBeenCalledTimes(1)
  })

  it('takes initial and restarted component assets and entry metadata from independent snapshot contexts', async () => {
    const watcher = { close: vi.fn(async () => {}) }
    const isolatedPlugin = { name: 'independent-snapshot-compiler' }
    const snapshotEntry = '/project/src/components/leaf/index.vue'
    createStatefulHmrSnapshotOptionsMock.mockResolvedValueOnce({
      options: { build: {}, plugins: [isolatedPlugin] },
      getGlobalStyleRoutes: () => [],
      getChildSources: () => ({ files: [], roots: [] }),
      getTailwindStyleOwners: () => new Map(),
      getGlassEaselAnalysisByOwner: () => new Map<string, GlassEaselAnalysisFact>(),
      getTemplateRegistrationSignatures: () => new Map([[snapshotEntry, 'independent-template-registration']]),
      getEntryIds: () => new Set([snapshotEntry]),
      getDelegatedComponentEntryIds: () => new Set<string>(),
    }).mockResolvedValueOnce({
      options: { build: {}, plugins: [isolatedPlugin] },
      getGlobalStyleRoutes: () => [],
      getChildSources: () => ({ files: [], roots: [] }),
      getTailwindStyleOwners: () => new Map(),
      getGlassEaselAnalysisByOwner: () => new Map<string, GlassEaselAnalysisFact>(),
      getTemplateRegistrationSignatures: () => new Map([[snapshotEntry, 'independent-template-registration']]),
      getEntryIds: () => new Set([snapshotEntry]),
      getDelegatedComponentEntryIds: () => new Set<string>(),
    })
    buildMock.mockImplementation(async options => ({
      output: [{
        type: 'asset',
        fileName: 'components/leaf/index.json',
        source: JSON.stringify(options.plugins.includes(isolatedPlugin)
          ? { component: true, options: { multipleSlots: true } }
          : { options: { multipleSlots: true } }),
      }],
    }))
    runStatefulHmrDevMock.mockResolvedValue(watcher)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/stale.ts', { id: '/project/src/stale.ts' })

    await createBuildService(ctx).build({ skipNpm: true })
    expect(ctx.configService.load).not.toHaveBeenCalled()
    await runStatefulHmrDevMock.mock.calls[0]![2]()
    expect(ctx.configService.load).toHaveBeenCalledTimes(1)

    for (const [, , , snapshots] of runStatefulHmrDevMock.mock.calls) {
      expect(snapshots.entryIds).toEqual(new Set([snapshotEntry]))
      expect(JSON.parse(snapshots.initial.output[0].source)).toEqual({ component: true, options: { multipleSlots: true } })
    }
    expect(createStatefulHmrSnapshotOptionsMock).toHaveBeenCalledTimes(2)
    expect(prepareStatefulClassicHandoffMock).not.toHaveBeenCalled()
  })

  it('replaces stateful session graphs and releases the replacement through the original public close handle', async () => {
    const graph = createModuleGraphService()
    const closed: string[] = []
    const entries = ['/project/src/pages/old.ts', '/project/src/pages/current.ts']
    const watchers = entries.map(entry => ({ close: async () => {
      closed.push(entry)
    } }))
    let sessionIndex = 0
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockImplementation(async () => {
      const entry = entries[sessionIndex]!
      const watcher = watchers[sessionIndex++]!
      const scope = {}
      const context = {
        getModuleInfo: (id: string) => id === entry ? { isEntry: true } : null,
        resolve: async () => ({ id: entry }),
      }
      graph.bindBuildContext(scope, context)
      graph.bindPluginContext(scope, context)
      graph.replaceEntryDependencies(entry, 'template', [`${entry}.wxml`])
      return watcher
    })
    const ctx = createMockContext({ moduleGraphService: graph })
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const service = createBuildService(ctx)

    const watcher = await service.build({ skipNpm: true }) as RolldownWatcher
    const closeOriginalWatcher = watcher.close.bind(watcher)
    expect(graph.hasModule(entries[0]!)).toBe(true)
    expect(graph.collectAffectedEntries(`${entries[0]}.wxml`)).toEqual(new Set([entries[0]]))
    await runStatefulHmrDevMock.mock.calls[0]![2]()

    expect(closed).toEqual([entries[0]])
    expect(graph.hasModule(entries[0]!)).toBe(false)
    expect(graph.collectAffectedEntries(`${entries[0]}.wxml`)).toEqual(new Set())
    expect(graph.hasModule(entries[1]!)).toBe(true)
    expect(await graph.resolve('./page')).toEqual({ id: entries[1] })

    await closeOriginalWatcher()
    expect(closed).toEqual(entries)
    expect(graph.hasModule(entries[1]!)).toBe(false)
    expect(graph.collectAffectedEntries(`${entries[1]}.wxml`)).toEqual(new Set())
  })

  it.each([true, false])('consumes a topology snapshot once and rebuilds when its input version changed (current: %s)', async (current) => {
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockResolvedValue({ close: vi.fn(async () => {}) })
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const entry = `${ctx.configService.absoluteSrcRoot}/added.vue`
    const snapshot = {
      output: [{ type: 'asset' as const, fileName: 'added.json', source: '{"component":true}' }],
      entryIds: [entry],
      delegatedComponentEntryIds: [entry],
      componentPageGlobalStyleRoutes: [],
      glassEaselAnalysisByOwner: new Map<string, GlassEaselAnalysisFact>(),
      templateRegistrationSignatures: new Map([[entry, 'topology-template-registration']]),
    }
    offerStatefulHmrSnapshot(ctx, new StatefulHmrSnapshotHandoff(snapshot, { scope: { roots: [], files: [], excluded: [] }, versions: new Map() }, async () => current))
    await runStatefulHmrDevMock.mock.calls[0]![2]()
    expect(buildMock).toHaveBeenCalledTimes(current ? 1 : 2)
    if (current) {
      expect(runStatefulHmrDevMock.mock.calls[1]![3].initial).toBe(snapshot)
      expect(runStatefulHmrDevMock.mock.calls[1]![3].entryIds).toEqual(new Set([entry]))
    }
    await runStatefulHmrDevMock.mock.calls[1]![2]()
    expect(buildMock).toHaveBeenCalledTimes(current ? 2 : 3)
    await watcher.close()
  })

  it('releases graph inputs registered after the original watcher closes during native restart', async () => {
    const graph = createModuleGraphService()
    const ctx = createMockContext({ moduleGraphService: graph })
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const entered = Promise.withResolvers<void>()
    const ready = Promise.withResolvers<void>()
    const dependency = '/project/src/shared.wxml'
    const closed: number[] = []
    let generation = 0
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockImplementation(async () => {
      const current = ++generation
      if (current === 2) {
        entered.resolve()
        await ready.promise
      }
      graph.replaceEntryDependencies(`/project/src/page-${current}.ts`, 'template', [dependency])
      return { close: async () => {
        closed.push(current)
      } }
    })
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const closeOriginalWatcher = watcher.close.bind(watcher)
    const restarting = runStatefulHmrDevMock.mock.calls[0]![2]()
    await entered.promise
    const closing = closeOriginalWatcher()
    ready.resolve()
    await Promise.all([restarting, closing])

    expect(closed).toEqual([1, 2])
    expect(graph.hasModule('/project/src/page-2.ts')).toBe(false)
    expect(graph.collectAffectedEntries(dependency)).toEqual(new Set())
  })

  it('serializes overlapping stateful restarts before starting the next session', async () => {
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let generation = 0
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockImplementation(async () => {
      const current = ++generation
      if (current === 2) {
        entered.resolve()
        await release.promise
      }
      return { close: vi.fn(async () => {}) }
    })

    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const restart = runStatefulHmrDevMock.mock.calls[0]![2] as () => Promise<void>
    const first = restart()
    await entered.promise
    const second = restart()
    await Promise.resolve()
    expect(runStatefulHmrDevMock).toHaveBeenCalledTimes(2)

    release.resolve()
    await Promise.all([first, second])
    expect(runStatefulHmrDevMock).toHaveBeenCalledTimes(3)
    await watcher.close()
  })

  it('releases stateful graph ownership after publication startup failure', async () => {
    const graph = createModuleGraphService()
    const ctx = createMockContext({ moduleGraphService: graph })
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const entry = '/project/src/pages/index.ts'
    const dependency = '/project/src/shared.wxml'
    const error = new Error('worker publication failed')
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockImplementationOnce(async () => {
      graph.replaceEntryDependencies(entry, 'template', [dependency])
      throw error
    })
    await expect(createBuildService(ctx).build({ skipNpm: true })).rejects.toBe(error)
    expect(graph.hasModule(dependency)).toBe(false)
    expect(graph.collectAffectedEntries(dependency)).toEqual(new Set())
  })

  it('waits for an in-flight native restart snapshot before close returns', async () => {
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockResolvedValue({ close: vi.fn(async () => {}) })
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const reached = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    buildMock.mockImplementationOnce(async () => {
      reached.resolve()
      await release.promise
      return { output: [] }
    })
    const restarting = runStatefulHmrDevMock.mock.calls[0]![2]()
    await reached.promise
    let closed = false
    const closing = watcher.close().then(() => {
      closed = true
    })
    try {
      await new Promise(resolve => setImmediate(resolve))
      expect(closed).toBe(false)
    }
    finally {
      release.resolve()
      await Promise.all([restarting, closing])
    }
    expect(closed).toBe(true)
    expect(runStatefulHmrDevMock).toHaveBeenCalledTimes(1)
  })

  it('retains a restart snapshot failure while the public watcher is closing', async () => {
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const statefulOwner = { close: vi.fn(async () => {}) }
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockResolvedValue(statefulOwner)
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const reached = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const failure = new Error('restart snapshot failed')
    buildMock.mockImplementationOnce(async () => {
      reached.resolve()
      await release.promise
      throw failure
    })
    const restarting = runStatefulHmrDevMock.mock.calls[0]![2]()
    const rejectedRestart = expect(restarting).rejects.toBe(failure)
    await reached.promise
    const closing = watcher.close()
    const rejectedClose = expect(closing).rejects.toBe(failure)
    release.resolve()
    await Promise.all([rejectedRestart, rejectedClose])
    await expect(watcher.close()).rejects.toBe(failure)
    expect(statefulOwner.close).toHaveBeenCalledOnce()
    expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
  })

  it.each(['owner-close', 'snapshot'] as const)('retains a settled %s restart failure for later idempotent public shutdown', async (stage) => {
    const failure = new Error(`stateful restart ${stage} failed`)
    const statefulOwner = { close: vi.fn(async () => {
      if (stage === 'owner-close') {
        throw failure
      }
    }) }
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockResolvedValue(statefulOwner)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    if (stage === 'snapshot') {
      buildMock.mockRejectedValueOnce(failure)
    }
    const restart = runStatefulHmrDevMock.mock.calls[0]![2]
    // 先等待失败任务彻底离开 pending 集合，再调用公共关闭，覆盖历史失败不能丢失。
    await expect(restart()).rejects.toBe(failure)
    await expect(restart()).rejects.toBe(failure)
    const closing = watcher.close()
    expect(watcher.close()).toBe(closing)
    await expect(closing).rejects.toBe(failure)
    await expect(watcher.close()).rejects.toBe(failure)
    expect(statefulOwner.close).toHaveBeenCalledOnce()
    expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
  })

  it('closes native resources and event subscriptions independently and retains both failures', async () => {
    const facade = createManualWatcher()
    const closeEvents = facade.close
    const ownerFailure = new Error('native session close failed')
    const eventsFailure = new Error('watcher events close failed')
    const statefulOwner = { close: vi.fn(async () => {
      throw ownerFailure
    }) }
    closeEvents.mockRejectedValueOnce(eventsFailure)
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockResolvedValue(statefulOwner)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const closing = watcher.close()
    expect(watcher.close()).toBe(closing)
    await expect(closing).rejects.toMatchObject({ errors: [ownerFailure, eventsFailure], cause: ownerFailure })
    expect(statefulOwner.close).toHaveBeenCalledOnce()
    expect(closeEvents).toHaveBeenCalledOnce()
  })

  it.each([false, true])('keeps original native subscribers and releases sessions when closing during restart=%s', async (closeDuringRestart) => {
    const { createDevBuildWatcher } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controller = createDevBuildWatcher()
    devBuildWatcherQueue.push({ watcher: controller.watcher, emitEvent: vi.fn(controller.emitEvent) })
    const liveSessions = new Set<number>()
    const observedSessions: number[][] = []
    let generation = 0
    let restart!: () => Promise<void>
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock.mockImplementation(async (
      _ctx: unknown,
      _options: unknown,
      restartSession: () => Promise<void>,
      _snapshots: unknown,
      events: DevBuildWatcherController,
    ) => {
      const id = ++generation
      liveSessions.add(id)
      restart = restartSession
      events.emitEvent({ code: 'END' })
      return {
        close: async () => {
          liveSessions.delete(id)
        },
      }
    })
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    await createBuildService(ctx).build({ skipNpm: true })
    const watcher: RolldownWatcher = ctx.watcherService.rollupWatcherMap.get('/')
    watcher.on('event', (event) => {
      if (event.code === 'END') {
        observedSessions.push([...liveSessions])
      }
    })
    await restart()
    expect(observedSessions).toEqual([[1], [2]])
    if (closeDuringRestart) {
      let release!: () => void
      let entered!: () => void
      const pending = new Promise<void>((resolve) => {
        release = resolve
      })
      const reached = new Promise<void>((resolve) => {
        entered = resolve
      })
      ctx.configService.load.mockImplementationOnce(async () => {
        entered()
        await pending
      })
      const restarting = restart()
      await reached
      const closing = watcher.close()
      release()
      await Promise.all([restarting, closing])
    }
    else {
      await watcher.close()
    }
    expect([...liveSessions]).toEqual([])
  })

  it.each([
    { configured: undefined, compileHotReLoad: true },
    { configured: 'auto' as const, compileHotReLoad: true },
    { configured: 'stateful-experimental' as const, compileHotReLoad: false },
  ])('forces classic dev for Skyline ($configured, hot reload: $compileHotReLoad)', async ({ configured, compileHotReLoad }) => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce({
        output: [{ fileName: 'app.json', source: JSON.stringify({ renderer: 'skyline' }), type: 'asset' }],
      })
      .mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    if (configured) {
      ctx.configService.weappViteConfig.hmr = { runtime: configured }
    }
    ctx.configService.projectPrivateConfig = {
      setting: { compileHotReLoad },
    }

    await createBuildService(ctx).build({ skipNpm: true })

    expect(runStatefulHmrDevMock).not.toHaveBeenCalled()
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenCalledWith(watcher, '/')
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('app.json'))
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('developers.weixin.qq.com'))
    expect(getHmrRuntimeSession(ctx).phase).toBe('classic')
    expect(getHmrRuntimeSession(ctx).fallback?.code).toBe('skyline')
    expect(disableProjectPrivateConfigHotReloadMock).not.toHaveBeenCalled()
    expect(ctx.configService.projectPrivateConfig.setting.compileHotReLoad).toBe(compileHotReLoad)
  })

  it('keeps Skyline classic fallback without writing private configuration', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce({
        output: [
          { fileName: 'app.json', source: JSON.stringify({ pages: ['pages/skyline/index'] }), type: 'asset' },
          { fileName: 'pages/skyline/index.json', source: JSON.stringify({ renderer: 'skyline' }), type: 'asset' },
        ],
      })
      .mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    ctx.configService.projectPrivateConfig = {
      setting: { compileHotReLoad: true },
    }

    await createBuildService(ctx).build({ skipNpm: true })

    expect(runStatefulHmrDevMock).not.toHaveBeenCalled()
    expect(disableProjectPrivateConfigHotReloadMock).not.toHaveBeenCalled()
    expect(ctx.configService.projectPrivateConfig.setting.compileHotReLoad).toBe(true)
    expect(getHmrRuntimeSession(ctx).phase).toBe('classic')
    expect(getHmrRuntimeSession(ctx).fallback?.code).toBe('skyline')
  })

  it('keeps explicit classic runtime when WeChat hot reload is enabled', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'classic' }
    ctx.configService.projectPrivateConfig = {
      setting: { compileHotReLoad: true },
    }

    const buildPromise = createBuildService(ctx).build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    expect(runStatefulHmrDevMock).not.toHaveBeenCalled()
    expect(loggerInfoMock).toHaveBeenCalledWith('HMR 模式：classic（显式配置）')
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('HMR 切换：修改 weapp.hmr.runtime 为 auto 或 stateful-experimental'))
  })

  it.each([
    { configured: 'auto', failed: false },
    { configured: 'stateful-experimental', failed: false },
    { configured: 'auto', failed: true },
  ] as const)('settles startup admission only after a successful classic native publication ($configured / failed=$failed)', async ({ configured, failed }) => {
    const { prepareClassicIdeConfig } = await vi.importActual<typeof import('../classicIdeConfig/prepare')>('../classicIdeConfig/prepare')
    const { createDevBuildWatcher } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controller = createDevBuildWatcher()
    devBuildWatcherQueue.push({ watcher: controller.watcher, emitEvent: vi.fn(controller.emitEvent) })
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-startup-admission-'))
    const file = path.join(root, 'project.private.config.json')
    const original = '{"setting":{"compileHotReLoad":true}}'
    await fs.writeFile(file, original)
    const ctx = createMockContext()
    Object.assign(ctx.configService, { cwd: root, outDir: path.join(root, 'dist'), projectPrivateConfigPath: file })
    ctx.configService.weappViteConfig.hmr = { runtime: configured }
    ctx.configService.projectPrivateConfig = { setting: { compileHotReLoad: true } }
    const runtime = getHmrRuntimeSession(ctx)
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const failure = new Error('initial classic publication failed')
    prepareClassicIdeConfigMock.mockImplementation(prepareClassicIdeConfig)
    buildMock.mockImplementationOnce(async () => {
      entered.resolve()
      await release.promise
      if (failed) {
        throw failure
      }
      return { output: [] }
    })
    const building = createBuildService(ctx).build({ skipNpm: true })
    const result = building.catch((error: unknown) => error)
    let watcher: RolldownWatcher | undefined
    try {
      await entered.promise
      expect(runtime.phase).toBe('switching')
      expect(runtime.fallback?.code).toBe('ide-classic-handoff')
      expect(await runtime.classicIdeConfig.readRequested(file)).toBe(original)
      expect(await fs.readJSON(file)).toEqual({ setting: { compileHotReLoad: false } })
      expect(runStatefulHmrDevMock).not.toHaveBeenCalled()
      expect(createStatefulHmrSnapshotOptionsMock).not.toHaveBeenCalled()
      release.resolve()
      if (failed) {
        expect(await result).toBe(failure)
        expect(runtime.phase).toBe('switching')
      }
      else {
        watcher = await building as RolldownWatcher
        expect(runtime.phase).toBe('classic')
        await runtime.whenSettled()
      }
      expect(ctx.configService.weappViteConfig.hmr.runtime).toBe(configured)
    }
    finally {
      release.resolve()
      await result
      await watcher?.close()
      prepareClassicIdeConfigMock.mockImplementation(async () => {})
      await runtime.classicIdeConfig.close()
      await fs.remove(root)
    }
    expect(await fs.pathExists(root)).toBe(false)
  })

  it.each(['auto', 'stateful-experimental'] as const)('falls back to classic when %s stateful runtime compatibility fails', async (configured) => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce({ output: [] })
    runStatefulHmrDevMock.mockRejectedValueOnce(new StatefulHmrRuntimeCompatibilityError('missing DevRuntime'))
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: configured }
    ctx.configService.projectPrivateConfig = {
      setting: { compileHotReLoad: true },
    }

    await createBuildService(ctx).build({ skipNpm: true })

    expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenCalledWith(watcher, '/')
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('"reason":"runtime-contract"'))
    expect(getHmrRuntimeSession(ctx).phase).toBe('classic')
    expect(getHmrRuntimeSession(ctx).fallback?.code).toBe('runtime-contract')
  })

  it('closes the active stateful owner once and transfers the original public watcher to classic', async () => {
    const facade = createManualWatcher()
    const statefulOwner = { close: vi.fn(async () => {}) }
    buildMock.mockResolvedValueOnce({ output: [] }).mockResolvedValueOnce(facade)
    runStatefulHmrDevMock.mockResolvedValueOnce(statefulOwner)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const publicWatcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
    const runtime = getHmrRuntimeSession(ctx)
    runtime.requestClassic({ code: 'config-json', message: 'app configuration changed' })
    await runtime.whenSettled()
    expect(runtime.phase).toBe('classic')
    expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
    expect(statefulOwner.close).toHaveBeenCalledOnce()
    expect(prepareStatefulClassicHandoffMock).toHaveBeenCalledExactlyOnceWith(ctx)
    expect(prepareStatefulClassicHandoffMock.mock.invocationCallOrder[0]!).toBeLessThan(statefulOwner.close.mock.invocationCallOrder[0]!)
    expect(prepareClassicIdeConfigMock).toHaveBeenCalledTimes(2)
    expect(statefulOwner.close.mock.invocationCallOrder[0]!).toBeLessThan(prepareClassicIdeConfigMock.mock.invocationCallOrder[1]!)
    expect(prepareClassicIdeConfigMock.mock.invocationCallOrder[1]!).toBeLessThan(buildMock.mock.invocationCallOrder[1]!)
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(publicWatcher)
    await publicWatcher.close()
    expect(statefulOwner.close).toHaveBeenCalledOnce()
    expect(prepareStatefulClassicHandoffMock).toHaveBeenCalledOnce()
  })

  it.each(['after-reload', 'during-reload', 'service-drain-during-reload'] as const)('keeps the original native facade owned after classic fallback and configuration reload (%s)', async (closeStage) => {
    const { createDevBuildWatcher } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controllers = Array.from({ length: 3 }, () => {
      const controller = createDevBuildWatcher()
      const closed = vi.fn(async () => {})
      controller.watcher.on('close', closed)
      devBuildWatcherQueue.push(controller as any)
      return { ...controller, closed }
    })
    const sidecars = Array.from({ length: 3 }, () => {
      const events = new EventEmitter()
      return Object.assign(events, {
        add: vi.fn(),
        unwatch: vi.fn(async () => {}),
        on: vi.fn(events.on.bind(events)),
        once: vi.fn(events.once.bind(events)),
        off: vi.fn(events.off.bind(events)),
        close: vi.fn(async () => {}),
      })
    })
    for (const sidecar of sidecars) {
      chokidarWatchMock.mockImplementationOnce(() => {
        // 模拟真实扫描在监听器登记后完成，配置 watcher 与每代 sidecar 都须等待 ready。
        queueMicrotask(() => sidecar.emit('ready'))
        return sidecar
      })
    }
    const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-native-classic-reload-'))))
    const srcRoot = path.join(root, 'src')
    const owner = path.join(srcRoot, 'pages/index.ts')
    const shared = path.join(srcRoot, 'shared.js')
    const config = path.join(root, 'vite.config.ts')
    await fs.outputFile(owner, 'import "../shared.js"; Page({})')
    await fs.outputFile(shared, 'export const marker = "before"')
    await fs.outputFile(config, 'export default {}')
    const graph = createModuleGraphService()
    const ctx = createMockContext({ moduleGraphService: graph })
    // 使用真实 drain 验证 façade 关闭委托到 classic 本代资源时不会反向等待公共关闭。
    createWatcherServicePlugin(ctx)
    Object.assign(ctx.configService, {
      cwd: root,
      absoluteSrcRoot: srcRoot,
      outDir: path.join(root, 'dist'),
      configFileDependencies: [config],
      relativeAbsoluteSrcRoot: (id: string) => path.relative(srcRoot, id),
    })
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const statefulOwner = { close: vi.fn(async () => {}) }
    if (closeStage === 'service-drain-during-reload') {
      runStatefulHmrDevMock.mockRejectedValueOnce(new HmrRuntimeCapabilityError({ code: 'compiler-provider', message: 'legacy provider has no HMR preparation' }))
    }
    else {
      runStatefulHmrDevMock.mockResolvedValueOnce(statefulOwner)
    }
    const publications: string[] = []
    let reloadStarted = false
    const finishReload = Promise.withResolvers<void>()
    buildMock.mockImplementation(async () => {
      if (closeStage !== 'after-reload' && publications.length === 2) {
        reloadStarted = true
        await finishReload.promise
      }
      graph.replaceEntryDependencies(owner, 'script', [shared])
      ctx.runtimeState.build.hmr.resolvedEntryMap.set(owner, { id: owner })
      publications.push(await fs.readFile(shared, 'utf8'))
      return { output: [] }
    })
    let publicWatcher: RolldownWatcher | undefined
    const awaitClose = async (closing: ReturnType<RolldownWatcher['close']>) => {
      let settled = false
      void closing.then(() => {
        settled = true
      }, () => {
        settled = true
      })
      await vi.waitFor(() => expect(settled).toBe(true))
      await closing
    }
    try {
      publicWatcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
      const closeOriginal = publicWatcher.close.bind(publicWatcher)
      // CLI backend 只持有 service drain；不能靠测试保存的 façade 弥补本代退休后的空图窗口。
      const close = closeStage === 'service-drain-during-reload'
        ? () => Promise.resolve(ctx.watcherService.closeAll())
        : closeOriginal
      const events: string[] = []
      publicWatcher.on('event', (event) => {
        events.push(event.code)
      })
      const runtime = getHmrRuntimeSession(ctx)
      if (closeStage === 'service-drain-during-reload') {
        expect(runtime.fallback?.code).toBe('compiler-provider')
      }
      else {
        runtime.requestClassic({ code: 'config-json', message: 'app configuration changed' })
      }
      await runtime.whenSettled()
      expect(runtime.phase).toBe('classic')
      expect(publicWatcher).toBe(controllers[0]!.watcher)
      expect(events.filter(event => event === 'END')).toHaveLength(1)

      sidecars[0]!.emit('all', 'change', config)
      let closing: ReturnType<RolldownWatcher['close']>
      if (closeStage !== 'after-reload') {
        await vi.waitFor(() => expect(reloadStarted).toBe(true))
        let closed = false
        closing = close()
        void closing.then(() => {
          closed = true
        }, () => {
          closed = true
        })
        await flushAsyncTasks()
        expect(closed).toBe(false)
        finishReload.resolve()
      }
      else {
        await vi.waitFor(() => expect(loggerSuccessMock).toHaveBeenCalledWith('Vite 配置已重新加载，小程序开发构建已重启。'))
        // 配置通知直接退休旧代，不再用旧有效配置额外发布一轮来触发 END。
        expect(events.filter(event => event === 'END')).toHaveLength(2)
        for (const marker of ['after', 'before']) {
          const count = publications.length
          await fs.writeFile(shared, `export const marker = "${marker}"`)
          moduleGraphProviderChange.handler!({ event: 'update', file: shared })
          await vi.waitFor(() => expect(publications).toHaveLength(count + 1))
          await vi.waitFor(() => expect(events.filter(event => event === 'END')).toHaveLength(count))
        }
        expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(publicWatcher)
        closing = close()
      }
      expect(close()).toBe(closing)
      await awaitClose(closing)
      expect(publications).toEqual((closeStage !== 'after-reload'
        ? ['before', 'before', 'before']
        : ['before', 'before', 'before', 'after', 'before']).map(marker => `export const marker = "${marker}"`))
      expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
      for (const controller of controllers) {
        expect(controller.closed).toHaveBeenCalledOnce()
      }
      for (const sidecar of sidecars) {
        expect(sidecar.close).toHaveBeenCalledOnce()
      }
      for (const result of createDevModuleGraphProviderMock.mock.results) {
        expect((await result.value).close).toHaveBeenCalledOnce()
      }
      if (closeStage === 'service-drain-during-reload') {
        expect(statefulOwner.close).not.toHaveBeenCalled()
      }
      else {
        expect(statefulOwner.close).toHaveBeenCalledOnce()
      }
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(graph.collectAffectedEntries(shared)).toEqual(new Set())
      expect(loggerErrorMock).not.toHaveBeenCalled()
      expect(close()).toBe(closing)
    }
    finally {
      finishReload.resolve()
      if (publicWatcher) {
        await awaitClose(publicWatcher.close())
      }
      await fs.remove(root)
    }
  })

  it.each(['auto', 'stateful-experimental'] as const)('starts classic for an unsupported initial compiler provider (%s)', async (configured) => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce({ output: [] }).mockResolvedValueOnce(watcher)
    runStatefulHmrDevMock.mockRejectedValueOnce(new HmrRuntimeCapabilityError({ code: 'compiler-provider', message: 'legacy provider has no HMR preparation' }))
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: configured }
    ctx.configService.projectPrivateConfig = { setting: { compileHotReLoad: true } }
    await createBuildService(ctx).build({ skipNpm: true })
    expect(getHmrRuntimeSession(ctx).phase).toBe('classic')
    expect(getHmrRuntimeSession(ctx).fallback?.code).toBe('compiler-provider')
    expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
    expect(ctx.configService.projectPrivateConfig.setting.compileHotReLoad).toBe(true)
  })

  it.each([
    new SyntaxError('invalid source syntax'),
    Object.assign(new Error('source read denied'), { code: 'EACCES' }),
    new TypeError('business setup rejected'),
    new Error('IDE protocol disconnected'),
  ])('preserves an ordinary startup failure without starting classic: %s', async (failure) => {
    buildMock.mockResolvedValueOnce({ output: [] })
    runStatefulHmrDevMock.mockRejectedValueOnce(failure)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    await expect(createBuildService(ctx).build({ skipNpm: true })).rejects.toBe(failure)
    expect(getHmrRuntimeSession(ctx).fallback).toBeUndefined()
    expect(runStatefulHmrDevMock).toHaveBeenCalledOnce()
    expect(buildMock).toHaveBeenCalledOnce()
  })

  it('runs dev app build with workers without a global refresh for local style updates', async () => {
    process.env.VITEST = 'false'
    delete process.env.NODE_ENV

    const watcher = createManualWatcher()
    checkWorkersOptionsMock.mockReturnValue({
      hasWorkersDir: true,
      workersDir: 'workers',
    })
    buildMock
      .mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build()
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    watcher.emit('START')
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['style-sidecar:1']
    watcher.emit('END')
    await flushAsyncTasks()

    expect(process.env.NODE_ENV).toBeUndefined()
    expect(cleanOutputsMock).toHaveBeenCalledTimes(1)
    expect(syncProjectConfigToOutputMock).not.toHaveBeenCalled()
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.npmBuilt).toBe(true)
    expect(touchMock).not.toHaveBeenCalled()
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenCalledWith(expect.any(Object), '/')
  })

  it('touches the page stylesheet emitted by an asset-only rebuild', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise
    await flushAsyncTasks()

    ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add('pages/logs/index.wxss')
    watcher.emit('START')
    watcher.emit('END')
    await waitForMockCalls(touchOutputStylesMock, 1)

    expect(touchOutputStylesMock).toHaveBeenCalledWith(
      '/project/dist',
      ['pages/logs/index.wxss'],
      'wxss',
    )
  })

  it('derives the page stylesheet from a CSS importer profile when output tracking is empty', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    ctx.configService.relativeOutputPath = (file: string) => file.replace('/project/src/', '')
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise
    await flushAsyncTasks()

    ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.clear()
    watcher.emit('START')
    ctx.runtimeState.build.hmr.profile.file = '/project/src/pages/logs/index.css'
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['css-importer:1']
    watcher.emit('END')
    await waitForMockCalls(touchOutputStylesMock, 1)

    expect(touchOutputStylesMock).toHaveBeenCalledWith(
      '/project/dist',
      ['pages/logs/index.wxss'],
      'wxss',
    )
  })

  it.each([false, true])('keeps one Tailwind output refresh owner when managed=%s', async (managed) => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    if (managed) {
      registerManagedTailwindcssEntries(ctx, ['app.css'])
    }
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['tailwind-content:1']
    watcher.emit('START')
    watcher.emit('END')
    await flushAsyncTasks()

    expect(touchMock).toHaveBeenCalledTimes(managed ? 0 : 1)
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-style-only:1']
    watcher.emit('START')
    watcher.emit('END')
    await flushAsyncTasks()
    expect(touchMock).toHaveBeenCalledTimes(managed ? 0 : 1)
  })

  it('reports a requested refresh failure instead of silently discarding it', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { touchAppWxss: true }
    const service = createBuildService(ctx)
    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    const failure = Object.assign(new Error('app style metadata denied'), { code: 'EACCES' })
    touchMock.mockRejectedValueOnce(failure)
    watcher.emit('START')
    watcher.emit('END')
    await waitForMockCalls(loggerErrorMock, 1)
    expect(loggerErrorMock).toHaveBeenCalledWith(failure)
  })

  it('does not touch app wxss for shared css importer hmr updates in auto mode', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['css-importer:4']
    watcher.emit('START')
    watcher.emit('END')
    await flushAsyncTasks()

    expect(touchMock).not.toHaveBeenCalled()
  })

  it('does not touch app wxss for script-only hmr updates in auto mode', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-direct:1']
    watcher.emit('START')
    watcher.emit('END')
    await flushAsyncTasks()

    expect(touchMock).not.toHaveBeenCalled()
  })

  it('keeps explicit touchAppWxss true behavior for script-only hmr updates', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    ctx.configService.weappViteConfig = {
      hmr: {
        touchAppWxss: true,
      },
    }
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-direct:1']
    watcher.emit('START')
    watcher.emit('END')
    await waitForMockCalls(touchMock, 1)

    expect(touchMock).toHaveBeenCalledWith('/project/dist/app.wxss')
  })

  it('forces dev watch builds to keep writing files to outDir', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(prepareClassicIdeConfigMock).toHaveBeenCalledWith(ctx)
    expect(prepareClassicIdeConfigMock.mock.invocationCallOrder[0]!).toBeLessThan(buildMock.mock.invocationCallOrder[0]!)
    expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
      build: expect.objectContaining({
        write: true,
      }),
    }))
  })

  it('does not run an extra snapshot write build after regular dev watch end events', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    expect(buildMock).toHaveBeenCalledTimes(1)
  })

  it('runs sidecar snapshot build with its own hmr timing window', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([
      '/project/src/pages/logs/index.ts',
    ]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    nowValue = 20
    emitSourceChange({ event: 'update', file: '/project/src/pages/logs/index.wxml' })
    nowValue = 28
    await waitForMockCalls(loggerSuccessMock, 1)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('8.00 ms'))
    nowSpy.mockRestore()
  })

  it('preserves shared dependency propagation for affected ordinary HMR chunks', async () => {
    const ctx = createMockContext()

    expect(await emitSharedChunkSnapshot(ctx)).toEqual(HMR_INCREMENTAL_OUTPUTS)
    expect(await emitSharedChunkSnapshot(ctx, { affectedSharedChunks: true })).toEqual(HMR_FULL_OUTPUTS)
    expect(await emitSharedChunkSnapshot(ctx, { metadataOnly: true })).toEqual(HMR_METADATA_CORE_OUTPUTS)
  })

  it('keeps incremental context B output unchanged while context A holds a full snapshot', async () => {
    const a = await startClassicSnapshotContext()
    const b = await startClassicSnapshotContext()
    const aEntered = Promise.withResolvers<void>()
    const releaseA = Promise.withResolvers<void>()
    const aEmitted = Promise.withResolvers<string[]>()
    const bEmitted = Promise.withResolvers<string[]>()
    const isolatedIncremental = await emitSharedChunkSnapshot(b.ctx)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      buildMock
        .mockImplementationOnce(async () => {
          aEntered.resolve()
          await releaseA.promise
          aEmitted.resolve(emitSharedChunkSnapshot(a.ctx))
          await aEmitted.promise
          return { output: [] }
        })
        .mockImplementationOnce(async () => {
          bEmitted.resolve(emitSharedChunkSnapshot(b.ctx))
          await bEmitted.promise
          return { output: [] }
        })

      a.onChange({ event: 'create', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      await aEntered.promise
      b.onChange({ event: 'update', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()

      expect(await bEmitted.promise).toEqual(isolatedIncremental)
      expect(isolatedIncremental).toEqual(HMR_INCREMENTAL_OUTPUTS)
      releaseA.resolve()
      expect(await aEmitted.promise).toEqual(HMR_FULL_OUTPUTS)
      await a.watcher.close()
      expect(await emitSharedChunkSnapshot(a.ctx)).toEqual(HMR_INCREMENTAL_OUTPUTS)
    }
    finally {
      releaseA.resolve()
      await Promise.all([a.watcher.close(), b.watcher.close()])
      vi.useRealTimers()
    }
  })

  it.each(['success', 'failure'] as const)('keeps context B full output after context A finishes with %s', async (outcome) => {
    const a = await startClassicSnapshotContext()
    const b = await startClassicSnapshotContext()
    const aEntered = Promise.withResolvers<void>()
    const bEntered = Promise.withResolvers<void>()
    const releaseA = Promise.withResolvers<void>()
    const releaseB = Promise.withResolvers<void>()
    const bEmitted = Promise.withResolvers<string[]>()
    let aEmitted: string[] | undefined
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      buildMock
        .mockImplementationOnce(async () => {
          aEntered.resolve()
          await releaseA.promise
          if (outcome === 'failure') {
            throw new Error('context A snapshot failed')
          }
          aEmitted = await emitSharedChunkSnapshot(a.ctx)
          return { output: [] }
        })
        .mockImplementationOnce(async () => {
          bEntered.resolve()
          await releaseB.promise
          bEmitted.resolve(emitSharedChunkSnapshot(b.ctx))
          await bEmitted.promise
          return { output: [] }
        })

      a.onChange({ event: 'create', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      await aEntered.promise
      b.onChange({ event: 'create', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      await bEntered.promise
      releaseA.resolve()
      await a.watcher.close()

      expect(await emitSharedChunkSnapshot(a.ctx)).toEqual(HMR_INCREMENTAL_OUTPUTS)
      if (outcome === 'success') {
        expect(aEmitted).toEqual(HMR_FULL_OUTPUTS)
      }
      releaseB.resolve()
      expect(await bEmitted.promise).toEqual(HMR_FULL_OUTPUTS)
    }
    finally {
      releaseA.resolve()
      releaseB.resolve()
      await Promise.all([a.watcher.close(), b.watcher.close()])
      vi.useRealTimers()
    }
  })

  it('releases failed full intent before recovery and the next ordinary snapshot', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    const failed = Promise.withResolvers<void>()
    const recovered = Promise.withResolvers<string[]>()
    const incremental = Promise.withResolvers<string[]>()
    loggerErrorMock.mockImplementationOnce(() => failed.resolve())
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      buildMock
        .mockRejectedValueOnce(new Error('full snapshot failed'))
        .mockImplementationOnce(async () => {
          recovered.resolve(emitSharedChunkSnapshot(ctx))
          await recovered.promise
          return { output: [] }
        })
        .mockImplementationOnce(async () => {
          incremental.resolve(emitSharedChunkSnapshot(ctx))
          await incremental.promise
          return { output: [] }
        })

      onChange({ event: 'create', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      await failed.promise
      expect(await emitSharedChunkSnapshot(ctx)).toEqual(HMR_INCREMENTAL_OUTPUTS)

      // 失败的 topology 事件会并入下一轮，恢复成功之后才回到普通增量。
      onChange({ event: 'update', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      expect(await recovered.promise).toEqual(HMR_FULL_OUTPUTS)
      onChange({ event: 'update', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      expect(await incremental.promise).toEqual(HMR_INCREMENTAL_OUTPUTS)
    }
    finally {
      await watcher.close()
      vi.useRealTimers()
    }
  })

  it('does not let an old snapshot finally clear a replacement runtime state', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      buildMock.mockImplementationOnce(async () => {
        entered.resolve()
        await release.promise
        return { output: [] }
      })
      onChange({ event: 'create', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      await entered.promise

      resetRuntimeStateForFreshBuild(ctx.runtimeState)
      expect(await emitSharedChunkSnapshot(ctx)).toEqual(HMR_INCREMENTAL_OUTPUTS)
      ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh = true
      release.resolve()
      await watcher.close()

      expect(await emitSharedChunkSnapshot(ctx)).toEqual(HMR_FULL_OUTPUTS)
    }
    finally {
      release.resolve()
      await watcher.close()
      ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh = false
      vi.useRealTimers()
    }
  })

  it.each([
    { event: 'delete' as const, file: '/project/.tmp/verification-gate/armed' },
    { event: 'update' as const, file: '/project/project.private.config.json' },
    { event: 'create' as const, file: '/project/unowned-source.ts' },
  ])('does not publish an unowned startup module notification: $event $file', async (change) => {
    const watcher = createManualWatcher()
    chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
    const ctx = createMockContext()
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    buildMock.mockImplementationOnce(async () => {
      emitSourceChange(change)
      return { output: [] }
    }).mockResolvedValue({ output: [] })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await createBuildService(ctx).build({ skipNpm: true })
      await vi.runOnlyPendingTimersAsync()
      await flushAsyncTasks()
      expect(buildMock).toHaveBeenCalledOnce()
      expect(ctx.moduleGraphService.recordChangedFile).not.toHaveBeenCalled()
      expect(ctx.scanService.markDirty).not.toHaveBeenCalled()
    }
    finally {
      await watcher.close()
      vi.useRealTimers()
    }
  })

  it.each(['graph', 'compiler-content'] as const)('retains startup input after its %s owner is registered by the initial build', async (owner) => {
    const watcher = createManualWatcher()
    const ctx = createMockContext()
    const file = '/external/inputs/late-content.ts'
    const content = createCompilerContentSourceOwner(ctx.configService)
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
    buildMock.mockImplementationOnce(async () => {
      emitSourceChange({ event: 'create', file })
      if (owner === 'graph') {
        ctx.moduleGraphService.hasModule.mockImplementation((id: string) => id === file)
      }
      else {
        content.replace('content-scan', source => source === file)
      }
      return { output: [] }
    }).mockResolvedValue({ output: [] })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await createBuildService(ctx).build({ skipNpm: true })
      await vi.runOnlyPendingTimersAsync()
      await flushAsyncTasks()
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledExactlyOnceWith(file, 'create')
    }
    finally {
      await watcher.close()
      content.dispose()
      vi.useRealTimers()
    }
  })

  it('keeps the consumed startup baseline after discarding unowned module notifications', async () => {
    const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'classic-initial-owner-'))))
    const file = path.join(root, 'app.json')
    const ctx = createMockContext()
    const release = startInitialBuildInputObservation(ctx.configService)
    const observation = getInitialBuildInputObservation(ctx.configService)!
    const filter = observation.filter.bind(observation)
    let handled = Promise.withResolvers<unknown[]>()
    const filtered = vi.spyOn(observation, 'filter').mockImplementation(async (changes) => {
      const retained = await filter(changes)
      handled.resolve(retained)
      return retained
    })
    const watcher = createManualWatcher()
    Object.assign(ctx.configService, { cwd: root, absoluteSrcRoot: root, outDir: path.join(root, 'dist') })
    ctx.moduleGraphService.hasModule.mockImplementation((id: string) => id === file)
    chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
    buildMock.mockImplementation(async () => {
      await readCompilerInput(ctx.configService, file)
      emitSourceChange({ event: 'update', file: path.join(root, 'unowned.ts') })
      return { output: [] }
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await fs.writeFile(file, '{"pages":[]}')
      await createBuildService(ctx).build({ skipNpm: true })
      await vi.runOnlyPendingTimersAsync()
      expect(await handled.promise).toEqual([])
      await flushAsyncTasks()
      expect(buildMock).toHaveBeenCalledOnce()

      handled = Promise.withResolvers<unknown[]>()
      emitSourceChange({ event: 'update', file })
      await vi.runOnlyPendingTimersAsync()
      expect(await handled.promise).toEqual([])
      await flushAsyncTasks()
      expect(buildMock).toHaveBeenCalledOnce()
      expect(ctx.moduleGraphService.recordChangedFile).not.toHaveBeenCalled()
    }
    finally {
      filtered.mockRestore()
      await watcher.close()
      release()
      vi.useRealTimers()
      await fs.remove(root)
    }
  })

  it('retains a queued missing dependency for recovery after the initial build fails', async () => {
    const watcher = createManualWatcher()
    const ctx = createMockContext()
    const file = '/external/inputs/recovered.ts'
    const failure = new Error('initial dependency is missing')
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
    const detachHost = attachDevModuleGraphHost(ctx, {} as ViteDevServer)
    buildMock.mockImplementationOnce(async () => {
      emitSourceChange({ event: 'create', file })
      throw failure
    }).mockResolvedValue({ output: [] })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await createBuildService(ctx).build({ skipNpm: true })
      await vi.runOnlyPendingTimersAsync()
      await flushAsyncTasks()
      expect(loggerErrorMock).toHaveBeenCalledWith(failure)
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledExactlyOnceWith(file, 'create')
    }
    finally {
      await watcher.close()
      detachHost()
      vi.useRealTimers()
    }
  })

  it('serializes source changes received during the initial publication behind that build', async () => {
    const watcher = createManualWatcher()
    chokidarWatchMock.mockReturnValue(createManualSidecarWatcher())
    const ctx = createMockContext()
    const initialRelease = Promise.withResolvers<void>()
    const initialStarted = Promise.withResolvers<void>()
    const sequence: string[] = []
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
    buildMock.mockImplementationOnce(async () => {
      sequence.push('initial-start')
      initialStarted.resolve()
      await initialRelease.promise
      sequence.push('initial-write-complete')
      return watcher
    }).mockImplementation(async () => {
      sequence.push('snapshot-write')
      return { output: [] }
    })
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    await initialStarted.promise
    try {
      emitSourceChange({ event: 'update', file: HMR_PAGE_ID })
      await waitForTimers(25)
      expect(buildMock).toHaveBeenCalledTimes(1)
    }
    finally {
      initialRelease.resolve()
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      await waitForMockCalls(buildMock, 2)
      await watcher.close()
    }
    expect(sequence).toEqual(['initial-start', 'initial-write-complete', 'snapshot-write'])
  })

  it('keeps queued source attribution behind the initial watcher replay and asset readiness', async () => {
    const { createDevBuildWatcher } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controller = createDevBuildWatcher()
    devBuildWatcherQueue.push(controller as any)
    chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
    const initialStarted = Promise.withResolvers<void>()
    const initialRelease = Promise.withResolvers<void>()
    const assetCreated = Promise.withResolvers<void>()
    const assetReady = Promise.withResolvers<void>()
    const snapshotStarted = Promise.withResolvers<void>()
    const snapshotRelease = Promise.withResolvers<void>()
    watchAssetSourcesMock.mockImplementationOnce(() => {
      assetCreated.resolve()
      return { ready: assetReady.promise, close: vi.fn(async () => {}) }
    })
    buildMock.mockImplementationOnce(async () => {
      initialStarted.resolve()
      await initialRelease.promise
      return { output: [] }
    }).mockImplementation(async () => {
      snapshotStarted.resolve()
      await snapshotRelease.promise
      return { output: [] }
    })
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    try {
      await initialStarted.promise
      emitSourceChange({ event: 'update', file: HMR_PAGE_ID })
      await waitForTimers(25)
      initialRelease.resolve()
      await assetCreated.promise
      await waitForTimers(25)
      // 真实控制器会同步回放首构 END；回放前不能把共享 profile 交给后续批次。
      expect(buildMock).toHaveBeenCalledTimes(1)
      assetReady.resolve()
      await firstBuild
      await snapshotStarted.promise
      snapshotRelease.resolve()
      await waitForMockCalls(appendFileMock, 1)
      expect(appendFileMock).toHaveBeenCalledOnce()
      const sample = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
      expect(sample).toMatchObject({
        status: 'complete',
        correlation: 'known',
        buildId: expect.any(String),
        batchId: expect.any(String),
        sourceEvents: [expect.objectContaining({ file: HMR_PAGE_ID, event: 'update' })],
      })
    }
    finally {
      initialRelease.resolve()
      assetReady.resolve()
      snapshotRelease.resolve()
      await firstBuild
      await controller.watcher.close()
    }
  })

  it.each([undefined, '/project/config/vite.config.ts'])('ignores managed support output throughout initial publication (config: %s)', async (configFilePath) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const ctx = createMockContext()
    ctx.configService.configFilePath = configFilePath
    const supportRoot = path.join(configFilePath ? path.dirname(configFilePath) : ctx.configService.cwd, '.weapp-vite')
    const initialStarted = Promise.withResolvers<void>()
    const initialRelease = Promise.withResolvers<void>()
    const files = ['auto-import-components.json', 'components.d.ts', 'typed-components.d.ts', 'mini-program.html-data.json', 'wevu-layouts.d.ts']
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
    buildMock.mockImplementationOnce(async () => {
      initialStarted.resolve()
      await initialRelease.promise
      return watcher
    }).mockResolvedValue({ output: [] })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    try {
      await initialStarted.promise
      for (const file of files) {
        emitSourceChange({ event: 'update', file: path.join(supportRoot, file) })
      }
      initialRelease.resolve()
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      await vi.runOnlyPendingTimersAsync()
      expect(buildMock).toHaveBeenCalledTimes(1)
      const initialCacheResets = resetEmittedOutputCachesMock.mock.calls.length

      for (const file of files) {
        emitSourceChange({ event: 'update', file: path.join(supportRoot, file) })
        sidecarWatcher.emit('change', path.join(supportRoot, file))
      }
      // 相同文件名的用户源码仍由依赖图接收，并且与真实页面更新合为一个窄快照。
      emitSourceChange({ event: 'update', file: '/project/src/auto-import-components.json' })
      emitSourceChange({ event: 'update', file: HMR_PAGE_ID })
      await vi.runOnlyPendingTimersAsync()
      await watcher.close()
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(ctx.moduleGraphService.recordChangedFile.mock.calls).toEqual([
        ['/project/src/auto-import-components.json', 'update'],
        [HMR_PAGE_ID, 'update'],
      ])
      expect(resetEmittedOutputCachesMock.mock.calls.length).toBe(initialCacheResets)
    }
    finally {
      initialRelease.resolve()
      await watcher.close()
      vi.useRealTimers()
    }
  })

  it('refreshes the App compiler owner for consecutive classic utility changes while keeping handler changes local', async () => {
    const scenario = await createAppShellSnapshotHarness(false)
    const { ctx, appId, appSource, pageIds } = scenario
    const page = pageIds[0]
    const source = `<script setup>const utility = 'bg-red-500'; function tap() { return 1 }</script><template><view :class="utility" /></template>`
    const handler = source.replace('return 1', 'return 2')
    const publications: Array<{ source: string, appReason: string | undefined, pageReason: string | undefined, summary: string[] | undefined, full: boolean }> = []
    try {
      await fs.writeFile(path.join(path.dirname(appId), 'app.css'), '@import "tailwindcss";')
      storeVueSfcHmrSignatures(ctx.runtimeState.build.hmr, page, resolveVueSfcHmrSignatures(source, page))
      ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([page]))
      buildMock.mockImplementation(async () => {
        const source = await readCompilerInput(ctx.configService, page)
        publications.push({
          source,
          appReason: ctx.runtimeState.build.hmr.dirtyEntryReasons.get(appId),
          pageReason: ctx.runtimeState.build.hmr.dirtyEntryReasons.get(page),
          summary: ctx.runtimeState.build.hmr.profile.dirtyReasonSummary,
          full: ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh === true,
        })
        storeVueSfcHmrSignatures(ctx.runtimeState.build.hmr, page, resolveVueSfcHmrSignatures(source, page))
        return { output: [] }
      })
      const sources = [handler, handler.replace('bg-red-500', 'bg-blue-500'), handler.replace('bg-red-500', 'bg-green-500'), source]
      for (const next of sources) {
        await fs.writeFile(page, next)
        await scenario.update(appSource(false), page)
        scenario.consumeDirtyEntries()
      }
      expect(publications).toEqual(sources.map((source, index) => ({
        source,
        appReason: index === 0 ? undefined : 'metadata',
        pageReason: 'direct',
        summary: index === 0 ? ['importer-graph:1'] : ['importer-graph:1', 'tailwind-content:1'],
        full: false,
      })))
    }
    finally {
      await scenario.close()
    }
  })

  it('retains an App script dependency reason when the same classic batch changes compiler content', async () => {
    const scenario = await createAppShellSnapshotHarness(false)
    const { ctx, appId, appSource, pageIds } = scenario
    const page = pageIds[0]
    const source = '<template><view class="bg-red-500" /></template>'
    try {
      await fs.writeFile(path.join(path.dirname(appId), 'app.css'), '@import "tailwindcss";')
      await fs.writeFile(page, source.replace('bg-red-500', 'bg-blue-500'))
      storeVueSfcHmrSignatures(ctx.runtimeState.build.hmr, page, resolveVueSfcHmrSignatures(source, page))
      ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([page, appId]))
      let appReason: string | undefined
      buildMock.mockImplementationOnce(async () => {
        appReason = ctx.runtimeState.build.hmr.dirtyEntryReasons.get(appId)
        return { output: [] }
      })
      await scenario.update(appSource(false), page)
      expect(appReason).toBe('direct')
    }
    finally {
      await scenario.close()
    }
  })

  it('rescans entry topology when external input capture fails after source refresh', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    ctx.scanService.markDirty = vi.fn()
    const rebuilt = Promise.withResolvers<void>()
    vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run) => {
      // 入口可在源刷新结束后消失；capture失败必须撤销入口扫描快照。
      expect(ctx.scanService.markDirty).not.toHaveBeenCalled()
      return await run({ forceFullRescan: true })
    })
    buildMock.mockImplementation(async () => {
      expect(ctx.scanService.markDirty).toHaveBeenCalled()
      expect(ctx.runtimeState.build.hmr.fullEntryScan).toBe(true)
      expect(ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh).toBe(true)
      rebuilt.resolve()
      return { output: [] }
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      onChange({ event: 'update', file: '/project/src/pages/logs/external.css' })
      await vi.runOnlyPendingTimersAsync()
      await rebuilt.promise
    }
    finally {
      await watcher.close()
      vi.useRealTimers()
    }
  })

  it.each([
    { event: 'update', full: false, chained: true },
    { event: 'delete', full: true, chained: true },
    { event: 'update', full: false, chained: false },
    { event: 'delete', full: true, chained: false },
  ] as const)('preserves source $event drift scope with full=$full and chained=$chained', async ({ event, full, chained }) => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    const file = '/project/src/pages/logs/external.css'
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const successor = Promise.withResolvers<void>()
    const publications: Array<{ full: boolean, events: unknown }> = []
    vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run, onDrift) => {
      const result = await run()
      onDrift([{ file, event }])
      return result
    })
    buildMock.mockImplementation(async () => {
      publications.push({
        full: ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh === true,
        events: ctx.runtimeState.build.hmr.profile.sourceEvents,
      })
      if (publications.length === 1) {
        started.resolve()
        await release.promise
      }
      else {
        successor.resolve()
      }
      return { output: [] }
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      onChange({ file, event: 'update' })
      await vi.runOnlyPendingTimersAsync()
      await started.promise
      if (chained) {
        onChange({ file, event: 'update' })
        // 定时器先把后继批次放入串行链，旧构建此时仍被显式屏障阻塞。
        await vi.runOnlyPendingTimersAsync()
      }
      expect(publications).toHaveLength(1)
      release.resolve()
      if (!chained) {
        await flushAsyncTasks()
        await vi.runOnlyPendingTimersAsync()
      }
      await successor.promise
      await vi.runOnlyPendingTimersAsync()
      await flushAsyncTasks()
      expect(loggerErrorMock).not.toHaveBeenCalled()
      expect(publications).toEqual([
        { full: false, events: [expect.objectContaining({ file, event: 'update' })] },
        { full, events: [expect.objectContaining({ file, event: chained ? 'update' : event })] },
      ])
      expect(buildMock).toHaveBeenCalledTimes(3)
      expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenLastCalledWith(file, event)
    }
    finally {
      release.resolve()
      await watcher.close()
      vi.useRealTimers()
    }
  })

  it('discards queued source changes after an unrecoverable initial publication failure', async () => {
    const ctx = createMockContext()
    const initialRelease = Promise.withResolvers<void>()
    const initialStarted = Promise.withResolvers<void>()
    const error = new Error('initial publication failed')
    buildMock.mockImplementationOnce(async () => {
      initialStarted.resolve()
      await initialRelease.promise
      throw error
    }).mockResolvedValue({ output: [] })
    const failure = expect(createBuildService(ctx).build({ skipNpm: true })).rejects.toBe(error)
    await initialStarted.promise
    emitSourceChange({ event: 'update', file: HMR_PAGE_ID })
    await waitForTimers(25)
    initialRelease.resolve()
    await failure
    await waitForTimers(25)
    expect(buildMock).toHaveBeenCalledTimes(1)
  })

  it('keeps sidecar invalidation narrow while retaining native metadata chunks for publication', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const emitted = Promise.withResolvers<string[]>()
    const dirtySummaries: Array<string[] | undefined> = []
    const ctx = createMockContext()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        emitted.resolve(emitSharedChunkSnapshot(ctx, { metadataOnly: true }))
        await emitted.promise
        dirtySummaries.push(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)
        return { output: [] }
      })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/about/index.ts', {
      id: '/project/src/pages/about/index.ts',
    })
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/logs/index.ts')
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/about/index.ts')
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([
      '/project/src/pages/logs/index.ts',
    ]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild
    touchMock.mockClear()

    emitSourceChange({ event: 'update', file: '/project/src/pages/logs/index.wxml' })
    await waitForMockCalls(buildMock, 2)
    expect(await emitted.promise).toEqual(HMR_METADATA_CORE_OUTPUTS)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      build: expect.objectContaining({ emptyOutDir: false }),
    }))
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set(['/project/src/pages/logs/index.ts']))
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get('/project/src/pages/logs/index.ts')).toBe('metadata')
    expect(dirtySummaries).toEqual([['sidecar-direct:1']])
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.has('/project/src/pages/logs/index.ts')).toBe(false)
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.has('/project/src/pages/about/index.ts')).toBe(true)
    expect(touchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['script', 'html', 'direct'],
    ['script', 'wxml', 'direct'],
    ['template', 'wxml', 'metadata'],
    ['style', 'wxss', 'metadata'],
  ] as const)('publishes an A→B→A %s dependency with .%s as %s', async (kind, extension, dirtyReason) => {
    const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-external-template-snapshot-'))))
    const owner = path.join(root, 'pages/index.vue')
    const unrelated = path.join(root, 'pages/other.vue')
    const external = path.join(root, `pages/view.${extension}`)
    const original = kind === 'style' ? 'view { color: red }' : '<button class="increment" @tap="increment">{{ count }}</button>'
    const changed = kind === 'style'
      ? 'view { color: blue }'
      : `<view>{{ count * 10 + 1 }}</view><button class="derived-increment" @tap="count += 2">advance</button>${original}`
    const ownerSource = `<script setup>const count = 0; function increment() {}</script>${kind === 'script' ? `<template src="./view.${extension}" />` : '<template><view>unchanged</view></template>'}`
    await fs.outputFile(owner, ownerSource)
    await fs.outputFile(unrelated, '<template><view>unrelated</view></template>')
    await fs.outputFile(external, original)
    const graph = createModuleGraphService()
    const ctx = createMockContext({ moduleGraphService: graph })
    Object.assign(ctx.configService, {
      cwd: root,
      absoluteSrcRoot: root,
      outDir: path.join(root, 'dist'),
      relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
      relativeOutputPath: (id: string) => path.relative(root, id),
    })
    const hmr = ctx.runtimeState.build.hmr
    for (const id of [owner, unrelated]) {
      hmr.resolvedEntryMap.set(id, { id })
      hmr.loadedEntrySet.add(id)
    }
    const snapshots: Array<{ source: string, reason: string | undefined, loaded: boolean, unrelatedLoaded: boolean, mixed: boolean }> = []
    const watcher = createManualWatcher()
    chokidarWatchMock.mockReturnValue(createManualSidecarWatcher())
    buildMock.mockImplementationOnce(async () => {
      graph.replaceEntryDependencies(owner, kind, [external])
      return watcher
    }).mockImplementation(async () => {
      snapshots.push({
        source: await fs.readFile(external, 'utf8'),
        reason: hmr.dirtyEntryReasons.get(owner),
        loaded: hmr.loadedEntrySet.has(owner),
        unrelatedLoaded: hmr.loadedEntrySet.has(unrelated),
        mixed: hmr.profile.dirtyReasonSummary?.includes('entry-mixed-asset:1') ?? false,
      })
      return { output: [] }
    })
    try {
      const firstBuild = createBuildService(ctx).build({ skipNpm: true })
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      const events = createDevBuildWatcherMock.mock.results.at(-1)!.value.emitEvent
      const settledEvents = () => events.mock.calls.filter(([event]) => event.code === 'END' || event.code === 'ERROR').length
      for (const source of [changed, original]) {
        // 模拟上一代入口已消费，恢复时必须再次让同一 Vue owner 的脚本失效。
        hmr.dirtyEntrySet.clear()
        hmr.dirtyEntryReasons.clear()
        hmr.dirtyVueEntryIds.clear()
        hmr.loadedEntrySet.add(owner)
        const before = settledEvents()
        await fs.writeFile(external, source)
        emitSourceChange({ event: 'update', file: external })
        await vi.waitFor(() => expect(settledEvents()).toBe(before + 1))
      }
      expect(snapshots).toEqual([changed, original].map(source => ({
        source,
        reason: dirtyReason,
        loaded: false,
        unrelatedLoaded: true,
        mixed: dirtyReason === 'direct',
      })))
      expect(buildMock).toHaveBeenCalledTimes(3)
      expect(await fs.readFile(owner, 'utf8')).toBe(ownerSource)
      expect(loggerErrorMock).not.toHaveBeenCalled()
    }
    finally {
      await watcher.close()
      await fs.remove(root)
    }
  })

  it.each([false, true])('pins initial App shell input and commits that generation when source changes during build (before=%s)', async (before) => {
    const reads: string[] = []
    const source = (present: boolean) => `<script setup>const marker = 'app'</script>${present ? '<template><view><slot /></view></template>' : ''}`
    const scenario = await createAppShellSnapshotHarness(before, async (ctx, appId) => {
      reads.push(await readCompilerInput(ctx.configService, appId))
      await fs.writeFile(appId, source(!before))
      reads.push(await readCompilerInput(ctx.configService, appId))
      // 其他 resolver 的较新观测不能成为本次已发布页面的应用壳版本。
      ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, !before)
    })
    try {
      expect(reads).toEqual([source(before), source(before)])
      await scenario.update(source(!before))
      for (const id of scenario.pageIds) {
        expect(scenario.ctx.runtimeState.build.hmr.dirtyEntryReasons.get(id)).toBe('direct')
        expect(scenario.ctx.runtimeState.build.hmr.loadedEntrySet.has(id)).toBe(false)
      }
      expect(scenario.ctx.runtimeState.build.hmr.dirtyEntrySet.has(scenario.componentId)).toBe(true)
      expect(scenario.ctx.runtimeState.build.hmr.loadedEntrySet.has(scenario.componentId)).toBe(false)
    }
    finally {
      await scenario.close()
    }
  })

  it('keeps App shell fixture IDs canonical when native realpath uses a different directory spelling', async () => {
    const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-app-shell-identity-'))))
    const physicalRoot = path.join(root, 'physical')
    const canonicalRoot = path.join(root, 'canonical')
    await fs.ensureDir(physicalRoot)
    await fs.symlink(physicalRoot, canonicalRoot, 'junction')
    const native = realpathSync.native
    const nativePath = vi.spyOn(realpathSync, 'native').mockImplementation((file) => {
      const resolved = path.normalize(native(file))
      const relative = path.relative(physicalRoot, resolved)
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
        ? path.join(canonicalRoot, relative)
        : resolved
    })
    const temporaryRoot = vi.spyOn(fs, 'mkdtemp').mockResolvedValueOnce(physicalRoot)
    let scenario: Awaited<ReturnType<typeof createAppShellSnapshotHarness>> | undefined
    try {
      // 模拟 Windows 短路径与 native 物理路径拥有不同拼写，文件仍指向同一目录。
      expect(path.normalize(realpathSync(physicalRoot))).not.toBe(path.normalize(realpathSync.native(physicalRoot)))
      scenario = await createAppShellSnapshotHarness(false)
      expect(scenario.appId).toBe(path.join(canonicalRoot, 'app.vue'))
      await scenario.update(scenario.appSource(true))
      expect(scenario.pageIds.every(id => scenario.ctx.runtimeState.build.hmr.dirtyEntrySet.has(id))).toBe(true)
    }
    finally {
      await scenario?.close()
      temporaryRoot.mockRestore()
      nativePath.mockRestore()
      await fs.remove(root)
    }
  })

  it.each([false, true])('publishes complete native output when an App shell template changes presence (before=%s)', async (before) => {
    const scenario = await createAppShellSnapshotHarness(before)
    const { appId, appSource, pageIds, componentId, ctx } = scenario
    try {
      let dirtyReasonSummary: string[] | undefined
      let fullOutput: boolean | undefined
      let fullScan: boolean | undefined
      const resets = resetEmittedOutputCachesMock.mock.calls.length
      ctx.scanService.markDirty.mockClear()
      buildMock.mockImplementationOnce(async () => {
        dirtyReasonSummary = ctx.runtimeState.build.hmr.profile.dirtyReasonSummary
        fullOutput = ctx.runtimeState.build.hmr.fullSnapshotOutput
        fullScan = ctx.runtimeState.build.hmr.fullEntryScan
        return { output: [] }
      })
      expect(ctx.runtimeState.build.hmr.vueEntryHasTemplate.get(appId)).toBe(before)
      await scenario.update(appSource(!before))

      expect(buildMock).toHaveBeenCalledTimes(2)
      for (const id of [appId, ...pageIds, componentId]) {
        expect(ctx.runtimeState.build.hmr.dirtyEntrySet.has(id)).toBe(true)
        expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get(id)).toBe('direct')
        expect(ctx.runtimeState.build.hmr.loadedEntrySet.has(id)).toBe(false)
        expect(ctx.runtimeState.build.hmr.dirtyVueEntryIds.has(id)).toBe(true)
      }
      for (const id of pageIds) {
        expect(await fs.readFile(id, 'utf8')).toBe('<template><view>unchanged</view></template>')
      }
      expect(dirtyReasonSummary).toEqual(['snapshot-full:4'])
      expect(fullOutput).toBe(true)
      expect(fullScan).toBe(true)
      expect(ctx.scanService.markDirty).toHaveBeenCalled()
      expect(resetEmittedOutputCachesMock.mock.calls.length).toBe(resets + 1)
      expect(ctx.runtimeState.build.hmr.fullSnapshotOutput).toBe(false)
      expect(ctx.runtimeState.build.hmr.fullEntryScan).toBe(false)
    }
    finally {
      await scenario.close()
    }
  })

  it.each([false, true])('replays App shell page invalidation after a failed publication advances live metadata (before=%s)', async (before) => {
    const scenario = await createAppShellSnapshotHarness(before)
    const { appId, appSource, pageIds, ctx } = scenario
    try {
      buildMock.mockImplementationOnce(async () => {
        ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, !before)
        scenario.consumeDirtyEntries()
        throw new Error('snapshot publication failed')
      })
      await scenario.update(appSource(!before))
      expect(ctx.runtimeState.build.hmr.vueEntryHasTemplate.get(appId)).toBe(!before)
      expect(pageIds.every(id => ctx.runtimeState.build.hmr.loadedEntrySet.has(id))).toBe(true)
      await scenario.update(appSource(!before))

      expect(buildMock).toHaveBeenCalledTimes(3)
      for (const id of pageIds) {
        expect(ctx.runtimeState.build.hmr.dirtyEntrySet.has(id)).toBe(true)
        expect(ctx.runtimeState.build.hmr.loadedEntrySet.has(id)).toBe(false)
      }
    }
    finally {
      await scenario.close()
    }
  })

  it.each([false, true])('uses the captured App shell generation when its source changes before input pinning (before=%s)', async (before) => {
    const scenario = await createAppShellSnapshotHarness(before)
    const { appId, appSource, pageIds, ctx } = scenario
    const captured = appSource(!before)
    const compiled: Array<{ source: string, pages: boolean[] }> = []
    try {
      vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run, _onDrift, preparation) => {
        await fs.writeFile(appId, captured)
        return await withCompilerSourceSnapshot(ctx.configService, new Map([[appId, captured]]), async () => {
          await preparation?.resolveAffectedEntries()
          return await run()
        })
      })
      buildMock.mockImplementationOnce(async () => {
        const source = await readCompilerInput(ctx.configService, appId)
        compiled.push({ source, pages: pageIds.map(id => ctx.runtimeState.build.hmr.dirtyEntrySet.has(id)) })
        ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, !before)
        return { output: [] }
      })
      await scenario.update(appSource(before))
      expect(compiled).toEqual([{ source: captured, pages: [true, true] }])
    }
    finally {
      await scenario.close()
    }
  })

  it.each([false, true])('publishes a captured App shell change before its delayed event joins an unrelated page batch (before=%s)', async (before) => {
    const scenario = await createAppShellSnapshotHarness(before)
    const { appId, appSource, pageIds, ctx } = scenario
    const captured = appSource(!before)
    const compiled: Array<{ source: string, app: boolean, pages: boolean[] }> = []
    try {
      ctx.moduleGraphService.collectAffectedEntries.mockReturnValueOnce(new Set([pageIds[0]]))
      vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run, _onDrift, preparation) => {
        await fs.writeFile(appId, captured)
        return await withCompilerSourceSnapshot(ctx.configService, new Map([[appId, captured]]), async () => {
          await preparation?.resolveAffectedEntries()
          return await run()
        })
      })
      buildMock.mockImplementationOnce(async () => {
        compiled.push({
          source: await readCompilerInput(ctx.configService, appId),
          app: ctx.runtimeState.build.hmr.dirtyEntrySet.has(appId),
          pages: pageIds.map(id => ctx.runtimeState.build.hmr.dirtyEntrySet.has(id)),
        })
        return { output: [] }
      })
      await scenario.update(appSource(before), pageIds[0])
      scenario.consumeDirtyEntries()
      await scenario.update(captured)
      expect(compiled).toEqual([{ source: captured, app: true, pages: [true, true] }])
      expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([appId]))
    }
    finally {
      await scenario.close()
    }
  })

  it('commits App shell presence from a full captured generation before the next local update', async () => {
    const scenario = await createAppShellSnapshotHarness(false)
    const { appId, appSource, ctx } = scenario
    const captured = appSource(true)
    try {
      vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run) => {
        return await withCompilerSourceSnapshot(ctx.configService, new Map([[appId, captured]]), async () => await run({ forceFullRescan: true }))
      })
      buildMock.mockImplementationOnce(async () => {
        expect(await readCompilerInput(ctx.configService, appId)).toBe(captured)
        // 共享 resolver 的较新观测不能代替本次已固定、实际参与编译的输入。
        ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, false)
        return { output: [] }
      })
      await scenario.update(captured)
      scenario.consumeDirtyEntries()
      await scenario.update(`${captured}<style>view { color: red; }</style>`)
      expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([appId]))
    }
    finally {
      await scenario.close()
    }
  })

  it.each(['content', 'script', 'style', 'config'] as const)('keeps App shell %s changes local after successfully publishing its presence', async (kind) => {
    const scenario = await createAppShellSnapshotHarness(false)
    const { appId, appSource, pageIds, componentId, ctx } = scenario
    try {
      buildMock.mockImplementationOnce(async () => {
        ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, true)
        return { output: [] }
      })
      await scenario.update(appSource(true))
      scenario.consumeDirtyEntries()
      ctx.scanService.markDirty.mockClear()
      const resets = resetEmittedOutputCachesMock.mock.calls.length
      const source = kind === 'content'
        ? appSource(true).replace('<view>', '<view class="changed">')
        : kind === 'script'
          ? appSource(true).replace('marker = \'app\'', 'marker = \'updated\'')
          : appSource(true) + (kind === 'style' ? '<style>.changed { color: red; }</style>' : '<config>{"window":{"navigationBarTitleText":"changed"}}</config>')
      buildMock.mockImplementationOnce(async () => {
        expect(ctx.runtimeState.build.hmr.fullSnapshotOutput).toBe(false)
        expect(ctx.runtimeState.build.hmr.fullEntryScan).toBe(false)
        return { output: [] }
      })
      await scenario.update(source)

      expect(buildMock).toHaveBeenCalledTimes(3)
      expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([appId]))
      expect(ctx.scanService.markDirty).not.toHaveBeenCalled()
      expect(resetEmittedOutputCachesMock.mock.calls.length).toBe(resets)
      for (const id of [...pageIds, componentId]) {
        expect(ctx.runtimeState.build.hmr.loadedEntrySet.has(id)).toBe(true)
      }
    }
    finally {
      await scenario.close()
    }
  })

  it('does not infer App shell presence when initial input capture failed', async () => {
    const scenario = await createAppShellSnapshotHarness(undefined)
    try {
      await scenario.update(scenario.appSource(true))
      expect(scenario.ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([scenario.appId]))
      for (const id of scenario.pageIds) {
        expect(scenario.ctx.runtimeState.build.hmr.loadedEntrySet.has(id)).toBe(true)
      }
    }
    finally {
      await scenario.close()
    }
  })

  it('does not commit a captured App shell from an unrelated generation that never compiles App', async () => {
    const scenario = await createAppShellSnapshotHarness(undefined)
    const { appId, appSource, pageIds, ctx } = scenario
    try {
      ctx.moduleGraphService.collectAffectedEntries.mockReturnValueOnce(new Set([pageIds[0]]))
      vueStyleSnapshotMock.mockImplementationOnce(async (_ctx, _entries, _files, run, _onDrift, preparation) => {
        return await withCompilerSourceSnapshot(ctx.configService, new Map([[appId, appSource(true)]]), async () => {
          await preparation?.resolveAffectedEntries()
          return await run()
        })
      })
      await scenario.update(appSource(true), pageIds[0])
      scenario.consumeDirtyEntries()
      await scenario.update(appSource(false))
      expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([appId]))
    }
    finally {
      await scenario.close()
    }
  })

  it.each([false, true].flatMap(shared => [false, true].flatMap(mainGraphModule => [false, true].map(watchRegistered => ({ shared, mainGraphModule, watchRegistered })))))('publishes independent updates without invalidating unrelated main entries (shared=$shared, mainGraphModule=$mainGraphModule, watchRegistered=$watchRegistered)', async ({ shared, mainGraphModule, watchRegistered }) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const ctx = createMockContext()
    const file = '/project/src/independent/index.json'
    const entry = '/project/src/pages/main/index.ts'
    const unrelated = '/project/src/pages/other/index.ts'
    ctx.scanService.markIndependentDirty = vi.fn()
    ctx.scanService.independentSubPackageMap = new Map([['independent', {}]])
    if (watchRegistered) {
      ctx.runtimeState.build.independent.watchFiles.set('independent', new Set([file]))
    }
    ctx.moduleGraphService.hasModule.mockReturnValue(mainGraphModule)
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set(shared ? [entry] : []))
    for (const id of [entry, unrelated]) {
      ctx.runtimeState.build.hmr.resolvedEntryMap.set(id, { id })
      ctx.runtimeState.build.hmr.loadedEntrySet.add(id)
    }
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock.mockResolvedValueOnce(watcher).mockResolvedValue({ output: [] })
    const service = createBuildService(ctx)
    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    expect(chokidarWatchMock.mock.calls[0]?.[0]).toContain('/project/src')
    sidecarWatcher.emit('change', file)
    await waitForMockCalls(buildMock, 2)
    expect(independentInvalidateMock).toHaveBeenCalledWith('independent')
    expect(ctx.scanService.markIndependentDirty).toHaveBeenCalledWith('independent')
    expect(ctx.scanService.markDirty).toHaveBeenCalled()
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set(shared ? [entry] : []))
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.has(unrelated)).toBe(true)
    expect(ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh).not.toBe(true)
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      build: expect.objectContaining({ emptyOutDir: false }),
    }))
    await watcher.close()
  })

  it.each(['sidecar', 'rapid-roots', 'removed-root', 'wxml-provider'] as const)('preserves independent publication ownership until the next serial snapshot consumes its event (%s)', async (source) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const ctx = createMockContext()
    const roots = ['current', 'queued', 'rapid', 'unrelated']
    const affectedRoots = source === 'wxml-provider' ? roots : source === 'rapid-roots' ? ['queued', 'rapid'] : ['queued']
    const outputFor = (root: string): RolldownOutput => ({
      output: [{ type: 'asset', fileName: `${root}/index.js`, source: root, names: [], originalFileNames: [] }],
    })
    ctx.scanService.markIndependentDirty = vi.fn()
    ctx.scanService.independentSubPackageMap = new Map(roots.map(root => [root, {}]))
    independentInvalidateMock.mockImplementation((root: string) => {
      ctx.runtimeState.build.independent.outputs.delete(root)
    })
    const currentBuildEntered = Promise.withResolvers<void>()
    const resumeCurrentBuild = Promise.withResolvers<void>()
    const nextBuildEntered = Promise.withResolvers<void>()
    let currentPublicationNames: string[] = []
    let queuedRootInvalidatedBeforeConsumption = false
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementationOnce(async () => {
        // options 已完成独立分包任务 drain，主包仍在异步 load/transform；尚未进入 generateBundle。
        ctx.runtimeState.build.independent.outputs.set('current', outputFor('current'))
        ctx.runtimeState.build.independent.pendingOutputs = []
        currentBuildEntered.resolve()
        await resumeCurrentBuild.promise
        // publication 的第一步读取当前 generation 的独立分包所有权，必须保留尚未消费的下一次保存。
        currentPublicationNames = captureIndependentOutputFileNames(ctx)
        return { output: [] }
      })
      .mockImplementationOnce(async () => {
        // 下一代 options 消费最新分包拓扑；移除发生在本轮串行消费后，不能撤销上一代发布归属。
        if (source === 'removed-root') {
          ctx.scanService.independentSubPackageMap.delete('queued')
        }
        for (const root of affectedRoots) {
          if (ctx.scanService.independentSubPackageMap.has(root)) {
            ctx.runtimeState.build.independent.outputs.set(root, outputFor(root))
          }
        }
        nextBuildEntered.resolve()
        return { output: [] }
      })
    const service = createBuildService(ctx)
    try {
      const firstBuild = service.build({ skipNpm: true })
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      for (const root of roots) {
        ctx.runtimeState.build.independent.outputs.set(root, outputFor(root))
      }

      sidecarWatcher.emit('change', '/project/src/current/index.json')
      await currentBuildEntered.promise
      independentInvalidateMock.mockClear()
      ctx.scanService.markIndependentDirty.mockClear()
      ctx.scanService.markDirty.mockClear()
      if (source === 'wxml-provider') {
        const dependency = '/project/transform-rules.json'
        ctx.runtimeState.wxmlProcessing.references.set(dependency, 1)
        emitSourceChange({ event: 'update', file: dependency })
      }
      else {
        sidecarWatcher.emit('change', '/project/src/queued/index.json')
        if (source === 'rapid-roots') {
          sidecarWatcher.emit('change', '/project/src/queued/index.json')
          sidecarWatcher.emit('change', '/project/src/rapid/index.json')
        }
      }
      queuedRootInvalidatedBeforeConsumption = !ctx.runtimeState.build.independent.outputs.has('queued')
        || independentInvalidateMock.mock.calls.length > 0
        || ctx.scanService.markIndependentDirty.mock.calls.length > 0
        || ctx.scanService.markDirty.mock.calls.length > 0
      resumeCurrentBuild.resolve()
      await nextBuildEntered.promise
      await watcher.close()

      expect(currentPublicationNames.sort()).toEqual(roots.map(root => `${root}/index.js`).sort())
      expect(queuedRootInvalidatedBeforeConsumption).toBe(false)
      expect(independentInvalidateMock.mock.calls).toEqual(affectedRoots.map(root => [root]))
      expect(ctx.scanService.markIndependentDirty.mock.calls).toEqual(affectedRoots.map(root => [root]))
      expect(ctx.runtimeState.build.independent.outputs.has('unrelated')).toBe(true)
      if (source === 'removed-root') {
        expect(captureIndependentOutputFileNames(ctx)).not.toContain('queued/index.js')
        expect(ctx.runtimeState.build.independent.outputs.has('queued')).toBe(false)
      }
      for (const [options] of buildMock.mock.calls) {
        expect(options.build.watch).toBeUndefined()
      }
      expect(ctx.runtimeState.build.hmr.dirtyEntrySet.size).toBe(0)
    }
    finally {
      resumeCurrentBuild.resolve()
      await watcher.close()
      independentInvalidateMock.mockReset()
    }
  })

  it('replays failed independent invalidation signals in the next serial batch without invalidating unrelated roots', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const ctx = createMockContext()
    ctx.scanService.independentSubPackageMap = new Map(['failed', 'recovery', 'unrelated'].map(root => [root, {}]))
    ctx.scanService.markIndependentDirty = vi.fn()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const failed = new Error('independent child syntax failed')
    const failedBuildEntered = Promise.withResolvers<void>()
    const recoveryBuildEntered = Promise.withResolvers<void>()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementationOnce(async () => {
        failedBuildEntered.resolve()
        throw failed
      })
      .mockImplementationOnce(async () => {
        recoveryBuildEntered.resolve()
        return { output: [] }
      })
    try {
      const firstBuild = createBuildService(ctx).build({ skipNpm: true })
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild

      sidecarWatcher.emit('change', '/project/src/failed/index.json')
      expect(independentInvalidateMock).not.toHaveBeenCalled()
      expect(ctx.scanService.markDirty).not.toHaveBeenCalled()
      await failedBuildEntered.promise
      await waitForMockCalls(loggerErrorMock, 1)
      expect(loggerErrorMock).toHaveBeenCalledWith(failed)
      expect(independentInvalidateMock.mock.calls).toEqual([['failed']])
      ctx.scanService.markDirty.mockClear()

      sidecarWatcher.emit('change', '/project/src/recovery/index.json')
      expect(independentInvalidateMock.mock.calls).toEqual([['failed']])
      expect(ctx.scanService.markDirty).not.toHaveBeenCalled()
      await recoveryBuildEntered.promise
      await watcher.close()

      expect(independentInvalidateMock.mock.calls).toEqual([['failed'], ['failed'], ['recovery']])
      expect(ctx.scanService.markIndependentDirty.mock.calls).toEqual([['failed'], ['failed'], ['recovery']])
      expect(ctx.scanService.markDirty).toHaveBeenCalledOnce()
      expect(ctx.runtimeState.build.hmr.dirtyEntrySet.size).toBe(0)
    }
    finally {
      await watcher.close()
    }
  })

  it.each(['before-change', 'after-change'] as const)('preserves WXML child invalidation registered %s while the initial snapshot is building', async (registration) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const ctx = createMockContext()
    const dependency = '/project/transform-rules.json'
    if (registration === 'before-change') {
      ctx.runtimeState.wxmlProcessing.references.set(dependency, 1)
    }
    ctx.scanService.independentSubPackageMap = new Map([['independent', {}]])
    ctx.scanService.markIndependentDirty = vi.fn()
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const initialBuildEntered = Promise.withResolvers<void>()
    const resumeInitialBuild = Promise.withResolvers<void>()
    buildMock
      .mockImplementationOnce(async () => {
        initialBuildEntered.resolve()
        await resumeInitialBuild.promise
        return { output: [] }
      })
      .mockResolvedValue({ output: [] })
    try {
      const firstBuild = createBuildService(ctx).build({ skipNpm: true })
      await initialBuildEntered.promise
      emitSourceChange({ event: 'update', file: dependency })
      if (registration === 'after-change') {
        ctx.runtimeState.wxmlProcessing.references.set(dependency, 1)
      }
      expect(independentInvalidateMock).not.toHaveBeenCalled()
      expect(ctx.scanService.markIndependentDirty).not.toHaveBeenCalled()
      resumeInitialBuild.resolve()
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      await waitForMockCalls(buildMock, 2)

      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(independentInvalidateMock.mock.calls).toEqual([['independent']])
      expect(ctx.scanService.markIndependentDirty.mock.calls).toEqual([['independent']])
    }
    finally {
      resumeInitialBuild.resolve()
      await watcher.close()
    }
  })

  it('classifies imported style changes through their graph-owned entry', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const dirtySummaries: Array<string[] | undefined> = []
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const ctx = createMockContext()
    const pageId = '/project/src/pages/logs/index.vue'
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(pageId, { id: pageId })
    ctx.moduleGraphService.collectAffectedEntries.mockImplementation((_file: string, kind?: string) => new Set(kind === 'script' ? [] : [pageId]))
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        dirtySummaries.push(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)
        return { output: [] }
      })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    emitSourceChange({ event: 'update', file: '/project/src/pages/logs/hello.css' })
    await waitForMockCalls(buildMock, 2)

    expect(dirtySummaries).toEqual([['css-importer:1']])
    expect(ctx.runtimeState.build.hmr.dirtyVueEntryIds).toEqual(new Set([pageId]))
  })

  it('batches consecutive sidecar snapshot events into one build', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const dirtySummaries: Array<string[] | undefined> = []
    const emitted = Promise.withResolvers<string[]>()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const ctx = createMockContext()
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/about/index.ts', {
      id: '/project/src/pages/about/index.ts',
    })
    ctx.moduleGraphService.collectAffectedEntries.mockImplementation((file: string) => {
      return new Set([
        file.endsWith('.wxml')
          ? '/project/src/pages/logs/index.ts'
          : '/project/src/pages/about/index.ts',
      ])
    })
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        dirtySummaries.push(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)
        emitted.resolve(emitSharedChunkSnapshot(ctx, { metadataOnly: true }))
        await emitted.promise
        return { output: [] }
      })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    emitSourceChange({ event: 'update', file: '/project/src/pages/logs/index.wxml' })
    emitSourceChange({ event: 'update', file: '/project/src/pages/about/index.wxss' })
    await waitForMockCalls(buildMock, 2)
    expect(await emitted.promise).toEqual(HMR_METADATA_CORE_OUTPUTS)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([
      '/project/src/pages/logs/index.ts',
      '/project/src/pages/about/index.ts',
    ]))
    expect(dirtySummaries).toEqual([['sidecar-direct:1', 'style-sidecar:1']])
  })

  it('retries a failed topology publication with a complete entry scan after the JSON cache has advanced', async () => {
    const watcher = createManualWatcher()
    chokidarWatchMock.mockReturnValue(createManualSidecarWatcher())
    const ctx = createMockContext()
    ctx.scanService.markDirty = vi.fn()
    const file = '/project/src/pages/logs/index.json'
    const cache = new Map<string, unknown>([[file, {}]])
    ctx.jsonService = {
      cache,
      read: async () => {
        const value = { usingComponents: { card: '/components/card/index' } }
        cache.set(file, value)
        return value
      },
    }
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
    const scans: boolean[] = []
    buildMock.mockResolvedValueOnce(watcher).mockImplementation(async () => {
      scans.push(ctx.runtimeState.build.hmr.fullEntryScan === true)
      if (scans.length === 1) {
        throw new Error('fixture topology build failed')
      }
      return { output: [] }
    })
    const service = createBuildService(ctx)
    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild
    try {
      emitSourceChange({ event: 'update', file })
      await waitForMockCalls(buildMock, 2)
      emitSourceChange({ event: 'update', file: HMR_PAGE_ID })
      await waitForMockCalls(buildMock, 3)
      expect(scans).toEqual([true, true])
      emitSourceChange({ event: 'update', file: HMR_PAGE_ID })
      await waitForMockCalls(buildMock, 4)
      expect(scans).toEqual([true, true, false])
      expect(ctx.runtimeState.build.hmr.fullEntryScan).toBe(false)
    }
    finally {
      await watcher.close()
    }
  })

  it('keeps full snapshot fallback for sidecar topology changes', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const emitted = Promise.withResolvers<string[]>()
    const ctx = createMockContext()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        emitted.resolve(emitSharedChunkSnapshot(ctx))
        await emitted.promise
        return { output: [] }
      })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.vue', {
      id: '/project/src/pages/logs/index.vue',
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/about/index.ts', {
      id: '/project/src/pages/about/index.ts',
    })
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/logs/index.vue')
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/about/index.ts')
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([
      '/project/src/pages/logs/index.vue',
    ]))
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('add', '/project/src/pages/logs/index.wxml')
    await waitForMockCalls(buildMock, 2)
    expect(await emitted.promise).toEqual(HMR_FULL_OUTPUTS)

    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([
      '/project/src/pages/logs/index.vue',
      '/project/src/pages/about/index.ts',
    ]))
    expect(ctx.runtimeState.build.hmr.dirtyVueEntryIds).toEqual(new Set([
      '/project/src/pages/logs/index.vue',
    ]))
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.size).toBe(0)
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      build: expect.objectContaining({ emptyOutDir: false }),
    }))
  })

  it.each([undefined, true, false])('routes atomic creates once and defers cleanup until publication with emptyOutDir=%s', async (emptyOutDir) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const emitted = Promise.withResolvers<string[]>()
    const ctx = createMockContext()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        emitted.resolve(emitSharedChunkSnapshot(ctx))
        await emitted.promise
        return { output: [] }
      })
    ctx.configService.inlineConfig.build = { emptyOutDir }
    const file = '/project/src/pages/logs/index.wxml'
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    emitSourceChange({ event: 'create', file })
    await waitForMockCalls(buildMock, 2)
    expect(await emitted.promise).toEqual(HMR_FULL_OUTPUTS)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledOnce()
    expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledWith(file, 'create')
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      build: expect.objectContaining({ emptyOutDir: false }),
    }))
  })

  it('continues snapshot builds after a transient topology build failure', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockRejectedValueOnce(new Error('transient atomic save'))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('unlink', '/project/src/pages/logs/index.wxss')
    await waitForMockCalls(buildMock, 2)
    await waitForMockCalls(loggerErrorMock, 1)

    const restoredFile = '/project/src/pages/logs/index.wxss'
    emitSourceChange({ event: 'create', file: restoredFile })
    await waitForMockCalls(buildMock, 3)
    await waitForMockCalls(loggerSuccessMock, 1)

    expect(buildMock).toHaveBeenCalledTimes(3)
  })

  it('establishes snapshot scanning before starting the provider or first publication', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createScanningSidecarWatcher()
    chokidarWatchMock.mockReturnValueOnce(sidecarWatcher)
    buildMock.mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    try {
      await waitForMockCalls(chokidarWatchMock, 1)
      expect(chokidarWatchMock).toHaveBeenCalledOnce()
      expect(createDevModuleGraphProviderMock).not.toHaveBeenCalled()
      expect(buildMock).not.toHaveBeenCalled()
      sidecarWatcher.ready()
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      expect(createDevModuleGraphProviderMock).toHaveBeenCalledOnce()
      expect(buildMock).toHaveBeenCalledOnce()
    }
    finally {
      sidecarWatcher.ready()
      // 旧顺序在首构 END 后才创建 sidecar 扫描；RED 也须完成本次模拟会话。
      await flushAsyncTasks()
      watcher.emit('START')
      watcher.emit('END')
      await flushAsyncTasks()
      sidecarWatcher.ready()
      const active = await firstBuild
      await active.close()
    }
  })

  it('gives a scoped sidecar one physical owner even after deletion drops its module registration', async () => {
    const { ctx, watcher, onProviderChange: onChange } = await startClassicSnapshotContext()
    const sidecarWatcher = chokidarWatchMock.mock.results.at(-1)!.value
    const file = '/project/src/pages/logs/index.wxss'
    buildMock.mockImplementation(async () => {
      ctx.moduleGraphService.hasModule.mockReturnValue(false)
      return { output: [] }
    })
    try {
      // Vite 的通知可先于 Chokidar，且原生重新扫描会撤销已经缺失的 style 依赖。
      onChange({ event: 'delete', file })
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledTimes(1)
      sidecarWatcher.emit('unlink', file)
      await waitForMockCalls(buildMock, 2)
      expect(ctx.moduleGraphService.hasModule(file)).toBe(false)
      await waitForTimers()
      onChange({ event: 'delete', file })
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledOnce()
    }
    finally {
      await watcher.close()
    }
  })

  it.each((['graph', 'compiler-content'] as const).flatMap(owner => (['create', 'update', 'delete'] as const).map(event => ({ owner, event }))))('delivers external $owner sidecar $event through its provider owner', async ({ owner, event }) => {
    const { ctx, watcher, onProviderChange } = await startClassicSnapshotContext()
    const file = '/external/inputs/content.wxss'
    const content = createCompilerContentSourceOwner(ctx.configService)
    ctx.moduleGraphService.hasModule.mockReturnValue(owner === 'graph')
    if (owner === 'compiler-content') {
      content.replace('external-content', source => source === file)
    }
    buildMock.mockResolvedValue({ output: [] })
    try {
      expect(ownsSidecarDelivery(ctx, file, event)).toBe(true)
      onProviderChange({ event, file })
      await waitForMockCalls(buildMock, 2)
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledExactlyOnceWith(file, event)
    }
    finally {
      await watcher.close()
      content.dispose()
    }
  })

  it('keeps unknown external sidecar updates available to the legacy owner', async () => {
    const { ctx, watcher, onProviderChange } = await startClassicSnapshotContext()
    const file = '/external/inputs/unknown.wxss'
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    try {
      expect(ownsSidecarDelivery(ctx, file, 'update')).toBe(false)
      onProviderChange({ event: 'update', file })
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledOnce()
      expect(ctx.moduleGraphService.recordChangedFile).not.toHaveBeenCalled()
    }
    finally {
      await watcher.close()
    }
  })

  it('delivers a scoped compiler-only update through the physical sidecar owner', async () => {
    const { ctx, watcher, onProviderChange } = await startClassicSnapshotContext()
    const file = '/project/src/shared/content.wxss'
    const content = createCompilerContentSourceOwner(ctx.configService)
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    content.replace('scoped-content', source => source === file)
    buildMock.mockResolvedValue({ output: [] })
    try {
      expect(ownsSidecarDelivery(ctx, file, 'update')).toBe(true)
      onProviderChange({ event: 'update', file })
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledOnce()
      chokidarWatchMock.mock.results.at(-1)!.value.emit('change', file)
      await waitForMockCalls(buildMock, 2)
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledExactlyOnceWith(file, 'update')
    }
    finally {
      await watcher.close()
      content.dispose()
    }
  })

  it('ignores vue updates in snapshot sidecar watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('change', '/project/src/pages/logs/index.vue')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).not.toHaveBeenCalled()
  })

  it('ignores plain script updates in snapshot sidecar watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('change', '/project/src/shared/runtime-dep.ts')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).not.toHaveBeenCalled()
  })

  it.each([true, false].flatMap(host => (['create', 'update', 'delete'] as const).map(event => ({ host, event }))))('routes WXML dependency $event without a module node (attached host: $host)', async ({ host, event }) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const ctx = createMockContext()
    const dependency = '/project/transform-rules.json'
    ctx.scanService.independentSubPackageMap = new Map([['independent', {}]])
    ctx.scanService.markIndependentDirty = vi.fn()
    ctx.runtimeState.wxmlProcessing.references.set(dependency, 1)
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    const detachHost = host ? attachDevModuleGraphHost(ctx, {} as ViteDevServer) : () => {}
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock.mockResolvedValue({ output: [] })
    try {
      const firstBuild = createBuildService(ctx).build({ skipNpm: true })
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild

      const missingDependency = new Error('WXML dependency is absent')
      if (event === 'delete') {
        buildMock.mockRejectedValueOnce(missingDependency)
      }
      emitSourceChange({ event, file: dependency })
      await waitForMockCalls(buildMock, 2)
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(independentInvalidateMock).toHaveBeenCalledWith('independent')
      expect(ctx.scanService.markIndependentDirty).toHaveBeenCalledWith('independent')
      expect(chokidarWatchMock.mock.calls[0]?.[0]).not.toContain(dependency)
      expect(sidecarWatcher.add.mock.calls.flat()).not.toContainEqual([dependency])
      sidecarWatcher.emit(event === 'delete' ? 'unlink' : event === 'create' ? 'add' : 'change', dependency)
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledTimes(2)
      if (event === 'delete') {
        const controller = createDevBuildWatcherMock.mock.results.at(-1)?.value
        expect(controller.emitEvent).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR', error: missingDependency }))
        emitSourceChange({ event: 'create', file: dependency })
        await waitForMockCalls(buildMock, 3)
        expect(buildMock).toHaveBeenCalledTimes(3)
        expect(controller.emitEvent).toHaveBeenLastCalledWith({ code: 'END' })
      }
    }
    finally {
      await ctx.watcherService.closeAll()
      detachHost()
    }
  })

  it.each([true, false])('accepts route topology outside the module graph once per source event (attached host: %s)', async (host) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const ctx = createMockContext()
    const file = '/project/src/pages/new/index.vue'
    ctx.configService.weappViteConfig.autoRoutes = true
    ctx.autoRoutesService = {
      ensureFresh: vi.fn(async () => {}),
      getSignature: () => 'routes',
      handleFileChange: vi.fn(async () => false),
      isRouteFile: (source: string) => source === file,
      isPageDeclarationSource: () => false,
    }
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    const releaseSource = registerAutoRoutesTopologySource(ctx, source => source === file)
    const detachHost = host ? attachDevModuleGraphHost(ctx, {} as ViteDevServer) : () => {}
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock.mockResolvedValue({ output: [] })
    try {
      const firstBuild = createBuildService(ctx).build({ skipNpm: true })
      await watcher.subscribed
      watcher.emit('START')
      watcher.emit('END')
      await firstBuild
      let count = 1
      for (const event of ['create', 'delete', 'create'] as const) {
        emitSourceChange({ event, file })
        await waitForTimers()
        expect(buildMock).toHaveBeenCalledTimes(count)
        expect(publishAutoRoutesTopology(ctx, { event, file, topologyChanged: true })).toBe(true)
        count += 1
        await waitForMockCalls(buildMock, count)
        expect(buildMock).toHaveBeenCalledTimes(count)
      }
      await watcher.close()
      await watcher.close()
      expect(publishAutoRoutesTopology(ctx, { event: 'create', file, topologyChanged: true })).toBe(false)
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledTimes(count)
    }
    finally {
      await watcher.close()
      releaseSource()
      detachHost()
    }
  })

  it('retains every coalesced topology source in one complete snapshot profile', async () => {
    const { ctx, watcher } = await startClassicSnapshotContext()
    const files = ['/project/src/pages/topology-vue/index.vue', '/project/src/pages/topology-added/index.ts']
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    buildMock.mockResolvedValue({ output: [] })
    try {
      const receivedAtMs = performance.now()
      publishAutoRoutesTopology(ctx, {
        file: files[1],
        event: 'delete',
        topologyChanged: true,
        sourceChanges: files.map(file => ({ file, event: 'delete', receivedAtMs })),
      })
      await waitForMockCalls(appendFileMock, 1)
      const profiles = appendFileMock.mock.calls.map(([, content]) => JSON.parse(content) as HmrProfileJsonSample)
      expect(profiles).toHaveLength(1)
      expect(profiles[0].status).toBe('complete')
      expect(profiles[0].sourceEvents?.map(({ file, event }) => ({ file, event }))).toEqual(files.map(file => ({ file, event: 'delete' })))
      expect(buildMock).toHaveBeenCalledTimes(2)
    }
    finally {
      await watcher.close()
    }
  })

  it('replaces entry metadata when a sidecar observes changed routes before the route watcher', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    const file = '/project/src/pages/logs/index.json'
    ctx.autoRoutesService = {
      handleFileChange: vi.fn(async () => true),
      getSignature: () => 'changed-routes',
    }
    ctx.moduleGraphService.invalidate = vi.fn(() => new Set<string>())
    const fullScans: boolean[] = []
    buildMock.mockImplementation(async () => {
      fullScans.push(ctx.runtimeState.build.hmr.fullEntryScan === true)
      return { output: [] }
    })
    try {
      onChange({ event: 'delete', file })
      await waitForMockCalls(buildMock, 2)
      expect(fullScans).toEqual([true])
      expect(ctx.scanService.markDirty).toHaveBeenCalled()
    }
    finally {
      await watcher.close()
    }
  })

  it.each([
    { event: 'create', arrival: 'pending' },
    { event: 'delete', arrival: 'pending' },
    { event: 'create', arrival: 'building' },
    { event: 'delete', arrival: 'building' },
  ] as const)('publishes a late route $event already discovered by scanning ($arrival snapshot)', async ({ event, arrival }) => {
    const { ctx, watcher } = await startClassicSnapshotContext()
    const first = '/project/src/pages/topology-added/index.ts'
    const late = '/project/src/pages/topology-vue/index.vue'
    ctx.configService.weappViteConfig.autoRoutes = true
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    ctx.autoRoutesService = {
      handleFileChange: vi.fn(async () => false),
      getSignature: () => 'scanned-route-version',
    }
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    ctx.moduleGraphService.invalidate = vi.fn(() => new Set<string>())
    const publication = Promise.withResolvers<void>()
    const sources: string[][] = []
    buildMock.mockImplementation(async () => {
      sources.push(ctx.runtimeState.build.hmr.profile.sourceEvents?.map((source: { file: string }) => source.file) ?? [])
      if (sources.length === 1 && arrival === 'building') {
        await publication.promise
      }
      return { output: [] }
    })
    try {
      publishAutoRoutesTopology(ctx, { event, file: first, topologyChanged: true })
      if (arrival === 'building') {
        await waitForMockCalls(buildMock, 2)
      }
      // 扫描已包含本轮完整拓扑，第二个物理事件不再改变服务签名，构建图仍没有它。
      publishAutoRoutesTopology(ctx, { event, file: late, topologyChanged: false })
      await waitForTimers()
      if (arrival === 'building') {
        expect(buildMock).toHaveBeenCalledTimes(2)
        expect(appendFileMock).not.toHaveBeenCalled()
      }
      publication.resolve()
      const snapshots = arrival === 'building' ? 2 : 1
      await waitForMockCalls(appendFileMock, snapshots)
      const profiles = appendFileMock.mock.calls.map(([, content]) => JSON.parse(content) as HmrProfileJsonSample)
      expect(profiles).toHaveLength(snapshots)
      expect(profiles.every(profile => profile.status === 'complete')).toBe(true)
      expect(profiles.flatMap(profile => profile.sourceEvents?.map(source => source.file) ?? [])).toEqual([first, late])
      expect(sources).toEqual(arrival === 'building' ? [[first], [late]] : [[first, late]])
      expect(buildMock).toHaveBeenCalledTimes(snapshots + 1)

      // native 已发布该版本后，无图的重复或无关通知不得再打开 snapshot。
      publishAutoRoutesTopology(ctx, { event, file: late, topologyChanged: false })
      publishAutoRoutesTopology(ctx, { event, file: '/project/src/pages/helpers.ts', topologyChanged: false })
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledTimes(snapshots + 1)
      expect(appendFileMock).toHaveBeenCalledTimes(snapshots)
    }
    finally {
      publication.resolve()
      await watcher.close()
    }
  })

  it('preserves ordinary source work when route parsing finds no topology change', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    const file = '/project/src/pages/logs/helpers.ts'
    ctx.configService.weappViteConfig.autoRoutes = true
    ctx.autoRoutesService = {
      handleFileChange: vi.fn(async () => false),
      getSignature: () => undefined,
      isRouteFile: (source: string) => source === file,
      isPageDeclarationSource: () => false,
    }
    buildMock.mockResolvedValue({ output: [] })
    const releaseSource = registerAutoRoutesTopologySource(ctx, source => source === file)
    try {
      onChange({ event: 'create', file })
      await waitForTimers()
      expect(buildMock).toHaveBeenCalledTimes(1)
      publishAutoRoutesTopology(ctx, { event: 'create', file, topologyChanged: false })
      await waitForMockCalls(buildMock, 2)
      expect(buildMock).toHaveBeenCalledTimes(2)
      onChange({ event: 'update', file })
      await waitForMockCalls(buildMock, 3)
      expect(buildMock).toHaveBeenCalledTimes(3)
    }
    finally {
      await watcher.close()
      releaseSource()
    }
  })

  it('routes native logical layout scripts through the dev graph provider', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const layoutId = '/project/src/layouts/default/index.ts'
    const pageId = '/project/src/pages/layouts/index.ts'
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(pageId, { id: pageId })
    ctx.moduleGraphService.isLogicalLayoutEntry.mockImplementation((id: string) => id === layoutId)
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(layoutId, { id: layoutId })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([layoutId, pageId]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    emitSourceChange({ event: 'update', file: layoutId })
    await waitForMockCalls(buildMock, 2)

    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([layoutId, pageId]))
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get(layoutId)).toBe('dependency')
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get(pageId)).toBe('dependency')
  })

  it('leaves existing linked script updates to the Rolldown watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.configService.inlineConfig = {
      build: {
        watch: {
          include: ['/workspace/packages/shared/**'],
        },
      },
    }
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    const [patterns] = chokidarWatchMock.mock.calls[0]!
    expect(patterns).toContain('/workspace/packages/shared')

    sidecarWatcher.emit('change', '/workspace/packages/shared/message.ts')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set())
  })

  it('ignores generated output updates in snapshot sidecar watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('change', '/project/dist/pages/logs/index.wxml')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).not.toHaveBeenCalled()
  })

  it.each(['create', 'update', 'delete'] as const)('routes copied asset %s through the normal snapshot build and closes its watcher', async (event) => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock.mockResolvedValueOnce(watcher).mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.moduleGraphService.hasModule.mockReturnValue(false)
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set())
    const buildPromise = createBuildService(ctx).build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    const result = await buildPromise
    const [, options] = watchAssetSourcesMock.mock.calls.at(-1)!
    const observer = watchAssetSourcesMock.mock.results.at(-1)!.value
    options.onChange('/project/src/resources/icon.png', event)
    await waitForMockCalls(buildMock, 2)
    expect(ctx.moduleGraphService.recordChangedFile).toHaveBeenCalledWith('/project/src/resources/icon.png', event)
    expect(resetEmittedOutputCachesMock).toHaveBeenCalled()
    await result.close()
    expect(observer.close).toHaveBeenCalledOnce()
  })

  it('closes snapshot sidecar watcher when main watcher closes directly', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    const result = await firstBuild

    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(1)
    await result.close()

    expect(sidecarWatcher.close).toHaveBeenCalledTimes(1)
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
  })

  it.each([false, true])('preserves sidecar cleanup failures while releasing the remaining classic resources (multiple=%s)', async (multiple) => {
    const watcher = createManualWatcher()
    const nativeClose = watcher.close
    const sidecarWatcher = createManualSidecarWatcher()
    const sidecarFailure = new Error('snapshot sidecar cleanup failed')
    const nativeFailure = new Error('native watcher cleanup failed')
    const resourceFailure = new Error('retained resource cleanup failed')
    sidecarWatcher.close.mockRejectedValueOnce(sidecarFailure)
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    if (multiple) {
      nativeClose.mockRejectedValueOnce(nativeFailure)
      ctx.watcherService.closeAll.mockRejectedValueOnce(resourceFailure)
    }
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    const result = await firstBuild
    const closing = result.close()
    expect(result.close()).toBe(closing)
    if (multiple) {
      const collectFailures = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(collectFailures) : [error]
      const failure = await closing.catch(error => error as unknown)
      expect(failure).toBeInstanceOf(AggregateError)
      expect(collectFailures(failure)).toEqual([resourceFailure, sidecarFailure, nativeFailure])
    }
    else {
      await expect(closing).rejects.toBe(sidecarFailure)
    }
    expect(nativeClose).toHaveBeenCalledOnce()
    expect(sidecarWatcher.close).toHaveBeenCalledOnce()
    expect(watchAssetSourcesMock.mock.results.at(-1)!.value.close).toHaveBeenCalledOnce()
    const provider = await createDevModuleGraphProviderMock.mock.results.at(-1)!.value
    expect(provider.close).toHaveBeenCalledOnce()
    expect(ctx.watcherService.closeAll).toHaveBeenCalledOnce()
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
  })

  it('releases its original sidecar without deleting or closing a replacement generation', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    const result = await firstBuild
    const sidecarRoot = [...ctx.watcherService.sidecarWatcherMap.keys()][0]
    const replacementSidecar = { close: vi.fn(async () => {}) }
    const replacementWatcher = { close: vi.fn(async () => {}) }
    ctx.watcherService.sidecarWatcherMap.set(sidecarRoot, replacementSidecar)
    ctx.watcherService.rollupWatcherMap.set('/', replacementWatcher)
    await result.close()
    expect(sidecarWatcher.close).toHaveBeenCalledOnce()
    expect(ctx.watcherService.sidecarWatcherMap.get(sidecarRoot)).toBe(replacementSidecar)
    expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(replacementWatcher)
    expect(replacementSidecar.close).not.toHaveBeenCalled()
    expect(replacementWatcher.close).not.toHaveBeenCalled()
  })

  it('restarts the dev watcher after config dependency changes request a restart', async () => {
    const watcher = createManualWatcher()
    const restartedWatcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const restartedSidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock
      .mockReturnValueOnce(sidecarWatcher)
      .mockReturnValueOnce(restartedSidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce(restartedWatcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    const originalScanState = ctx.runtimeState.scan
    ctx.runtimeState.json.cache.set('/project/src/app.json', { stale: true })
    ctx.runtimeState.autoImport.registry.set('StaleComp', { kind: 'local', name: 'StaleComp', from: '/project/src/components/StaleComp/index' } as any)
    syncProjectSupportFilesMock.mockResolvedValueOnce({
      managedTsconfigChanged: true,
      managedTsconfigWarnings: ['srcRoot mismatch'],
    })

    service.requestConfigRestart('app')
    watcher.emit('START')
    watcher.emit('END')

    await restartedWatcher.subscribed
    restartedWatcher.emit('START')
    restartedWatcher.emit('END')
    await flushAsyncTasks()

    expect(sidecarWatcher.close).toHaveBeenCalledTimes(1)
    expect(ctx.configService.load).toHaveBeenCalledWith(ctx.configService.loadOptions)
    expect(syncProjectSupportFilesMock).toHaveBeenCalledWith(ctx)
    expect(loggerWarnMock).toHaveBeenCalledWith('srcRoot mismatch')
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.scan).toBe(originalScanState)
    expect(ctx.runtimeState.json.cache.get('/project/src/app.json')).toBeUndefined()
    expect(ctx.runtimeState.autoImport.registry.size).toBe(0)
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(restartedWatcher)
    expect(loggerInfoMock).toHaveBeenCalledWith('检测到 Vite 配置变更，正在重启小程序开发构建...')
    expect(loggerSuccessMock).not.toHaveBeenCalledWith(expect.stringContaining('小程序已重新构建'))
    expect(loggerSuccessMock).toHaveBeenCalledWith('Vite 配置已重新加载，小程序开发构建已重启。')
  })

  it('keeps the app entry scan error when config restart cannot reload entries', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const appEntryError = new Error('在 /project/src 目录下没有找到 `app.json`、`app.json.ts` 或 `app.vue`')
    ctx.scanService.loadAppEntry.mockRejectedValueOnce(appEntryError)
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    service.requestConfigRestart('app')
    watcher.emit('START')
    watcher.emit('END')

    await waitForMockCalls(ctx.scanService.loadAppEntry, 1)
    await flushAsyncTasks()
    expect(ctx.scanService.loadSubPackages).not.toHaveBeenCalled()
    expect(buildMock).toHaveBeenCalledTimes(1)
  })

  it('registers real snapshot sidecar directories and ignores generated roots', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.configService.absoluteSrcRoot = '/project'
    ctx.configService.outDir = '/project/dist'
    ctx.configService.mpDistRoot = 'dist'
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    const [patterns, options] = chokidarWatchMock.mock.calls[0]!
    expect(patterns).toEqual(['/project'])
    expect(options.ignored('/project/node_modules/tdesign-miniprogram/miniprogram_dist/button/button.wxml')).toBe(true)
    expect(options.ignored('/project/dist/pages/index/index.wxml')).toBe(true)
    expect(options.ignored('/project/.weapp-vite/components.d.ts')).toBe(true)
    expect(options.ignored('/project/pages/index/index.wxml')).toBe(false)
  })

  it('prints hmr phase timings on rebuild completion and resets the profile', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      eventId: 'hmr-event-1',
      file: '/project/src/pages/logs/index.vue',
      event: 'update',
      buildStartMs: 4,
      pluginResolveMs: 2,
      transformMs: 9.5,
      coreTransformMs: 2.5,
      wevuTransformMs: 3,
      vueTransformMs: 4,
      writeMs: 5.25,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
      sharedChunkResolveMs: 1.75,
      entryChunkLoadMs: 6.5,
      entryChunkEmitFileMs: 0.75,
      chunkEmitCount: 3,
      loadCount: 2,
      resolveCount: 5,
      skippedLoadedCount: 1,
      dirtyCount: 2,
      pendingCount: 2,
      emittedCount: 2,
      dirtyReasonSummary: ['entry-direct:1', 'importer-graph:1'],
      pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
    }
    watcher.emit('START')
    watcher.emit('END')

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('小程序已重新构建（'))
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringMatching(/小程序已重新构建（\d+\.\d{2} ms）/))
    expect(ctx.runtimeState.build.hmr.profile).toEqual({})
  })

  it('tracks recent hmr samples and prints a rolling summary for rebuild trends', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    for (let index = 0; index < 6; index += 1) {
      ctx.runtimeState.build.hmr.profile = {
        watchToDirtyMs: 2 + index,
        emitMs: 10 + index,
        sharedChunkResolveMs: 1 + index,
        dirtyCount: 1,
        pendingCount: 2 + index,
        emittedCount: 1,
      }
      watcher.emit('START')
      watcher.emit('END')
    }

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledTimes(6)
    })
    expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(5)
    expect(loggerSuccessMock).toHaveBeenLastCalledWith(expect.stringMatching(/小程序已重新构建（\d+\.\d{2} ms）/))
  })

  it('prints concise hmr log when hmr.logLevel is concise', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(177.25)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            logLevel: 'concise',
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      buildCoreMs: 120.5,
      transformMs: 40.25,
      vueCompileMs: 12.5,
      vueFinalizeCodeMs: 2.25,
      writeMs: 6.5,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
    }
    watcher.emit('START')
    watcher.emit('END')

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('build-core '))
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('transform 40.25 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('vue-compile 12.50 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('vue-finalize-code 2.25 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('write 6.50 ms'))
    expect(loggerSuccessMock).not.toHaveBeenCalledWith(expect.stringContaining('watch->dirty'))
    expect(loggerSuccessMock).not.toHaveBeenCalledWith(expect.stringContaining('d/p/e'))
    nowSpy.mockRestore()
  })

  it('prints verbose hmr log only when hmr.logLevel is verbose', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(177)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(379)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            logLevel: 'verbose',
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    for (const profile of [
      {
        buildCoreMs: 40,
        transformMs: 10,
        vueCompileMs: 4,
        writeMs: 3,
        watchToDirtyMs: 2,
        emitMs: 8,
        sharedChunkResolveMs: 1,
        dirtyCount: 1,
        pendingCount: 2,
        emittedCount: 2,
        dirtyReasonSummary: ['entry-direct:1'],
        pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
      },
      {
        buildCoreMs: 42,
        transformMs: 11,
        vueCompileMs: 5,
        writeMs: 4,
        watchToDirtyMs: 3,
        emitMs: 9,
        sharedChunkResolveMs: 2,
        dirtyCount: 1,
        pendingCount: 2,
        emittedCount: 2,
        dirtyReasonSummary: ['entry-direct:1'],
        pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
      },
    ]) {
      ctx.runtimeState.build.hmr.profile = profile
      watcher.emit('START')
      watcher.emit('END')
    }

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('build-core '))
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('transform 11.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('vue-compile 5.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('write 4.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('watch->dirty 3.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('d/p/e 1/2/2'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('cause entry -> shared+1'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('近2次 avg'))
    nowSpy.mockRestore()
  })

  it('freezes published samples before asynchronous I/O and keeps the next build isolated', async () => {
    const { ctx, watcher } = await startClassicSnapshotContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    const directory = Promise.withResolvers<void>()
    mkdirMock.mockImplementationOnce(() => directory.promise)
    ctx.runtimeState.build.hmr.profile = { file: '/project/src/first.ts', eventId: 'first', event: 'update', dirtyReasonSummary: ['first:1'] }
    watcher.emit('START')
    watcher.emit('END')
    ctx.runtimeState.build.hmr.profile = { file: '/project/src/second.ts', eventId: 'second', event: 'update' }
    watcher.emit('START')
    directory.resolve()
    await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(1))
    const first = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
    expect(first).toMatchObject({ schemaVersion: 1, pipeline: 'standard', status: 'complete', eventId: 'first', dirtyReasonSummary: ['first:1'] })
    expect(ctx.runtimeState.build.hmr.profile.eventId).toBe('second')
    watcher.emit('END')
    await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(2))
    const second = JSON.parse(appendFileMock.mock.calls[1][1]) as HmrProfileJsonSample
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.buildId).not.toBe(first.buildId)
    await watcher.close()
  })

  it('finishes asynchronous output style handling before the next snapshot owns source attribution', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    const successLogs = loggerSuccessMock.mock.calls.length
    const styleStarted = Promise.withResolvers<void>()
    const styleRelease = Promise.withResolvers<void>()
    touchOutputStylesMock.mockImplementationOnce(async () => {
      styleStarted.resolve()
      await styleRelease.promise
      return new Set<string>()
    })
    buildMock.mockImplementation(async () => {
      ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add('pages/logs/index.wxss')
      return { output: [] }
    })
    const firstFile = '/project/src/pages/logs/first.ts'
    const secondFile = '/project/src/pages/logs/second.ts'
    try {
      onChange({ event: 'update', file: firstFile })
      await styleStarted.promise
      onChange({ event: 'update', file: secondFile })
      await waitForTimers(25)
      // 上一 END 仍会 reset profile，下一批次必须等其样式收尾交还所有权。
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(appendFileMock).not.toHaveBeenCalled()
      expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(0)
      expect(loggerSuccessMock).toHaveBeenCalledTimes(successLogs)
      styleRelease.resolve()
      await waitForMockCalls(appendFileMock, 2)
      expect(appendFileMock).toHaveBeenCalledTimes(2)
      const samples = appendFileMock.mock.calls.map(call => JSON.parse(call[1]) as HmrProfileJsonSample)
      expect(samples.map(sample => sample.sourceEvents?.map(event => event.file))).toEqual([[firstFile], [secondFile]])
      expect(samples.map(sample => sample.correlation)).toEqual(['known', 'known'])
      expect(samples.every(sample => sample.status === 'complete' && Boolean(sample.batchId))).toBe(true)
      expect(new Set(samples.map(sample => sample.buildId)).size).toBe(2)
      expect(new Set(samples.map(sample => sample.batchId)).size).toBe(2)
    }
    finally {
      styleRelease.resolve()
      await watcher.close()
    }
  })

  it.each([false, true])('settles native plugin END only after its style refresh and isolates the next generation (failure=%s)', async (fails) => {
    const watcher = createManualWatcher()
    watcher.close.mockResolvedValue(undefined)
    const ctx = createMockContext()
    ctx.configService.pluginOnly = true
    ctx.configService.absolutePluginRoot = '/project/src/plugin'
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    buildMock.mockResolvedValueOnce(watcher)
    const firstBuild = createBuildService(ctx).build({ skipNpm: true })
    await watcher.subscribed
    const onEvent = watcher.on.mock.calls.find(([event]: [string]) => event === 'event')![1] as (event: { code: string }) => void | Promise<void>
    await onEvent({ code: 'START' })
    await onEvent({ code: 'END' })
    await firstBuild

    const firstFile = '/project/src/plugin/components/control/index.ts'
    const lateFile = '/project/src/plugin/components/control/handler.ts'
    const styleFile = '/project/src/plugin/components/control/theme.css'
    const failure = Object.assign(new Error('plugin output style metadata denied'), { code: 'EACCES' })
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const successLogs = loggerSuccessMock.mock.calls.length
    touchOutputStylesMock.mockImplementationOnce(async () => {
      started.resolve()
      await release.promise
      if (fails) {
        throw failure
      }
      return new Set<string>()
    })
    recordHmrStyleUpdate(ctx.configService, firstFile, {
      styleFiles: [styleFile],
      compilerContentOwners: [[firstFile, 'tailwind-content']],
      cssImporterOwners: [firstFile],
    })
    const releaseFirst = beginHmrStyleUpdatePlan(ctx.configService, [firstFile])
    const firstPlan = getHmrStyleUpdatePlan(ctx.configService)
    ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add('components/control/index.wxss')
    ctx.runtimeState.build.hmr.profile = { eventId: 'plugin-first', file: firstFile, event: 'update', batchId: 'plugin-first-batch' }
    await onEvent({ code: 'START' })
    // 与 Rolldown 一样等待 listener 返回值；普通手动 watcher 的 emit 会丢掉 Promise。
    const completion = Promise.resolve(onEvent({ code: 'END' })).then(() => undefined, error => error)
    const pendingPlan = getHmrStyleUpdatePlan(ctx.configService)
    recordHmrStyleUpdate(ctx.configService, lateFile)
    let nextStarted = false
    let releaseNext: (() => void) | undefined
    const next = completion.then((outcome) => {
      nextStarted = true
      releaseNext = beginHmrStyleUpdatePlan(ctx.configService, [lateFile])
      ctx.runtimeState.build.hmr.profile = { eventId: 'plugin-next', file: lateFile, event: 'update', batchId: 'plugin-next-batch' }
      onEvent({ code: 'START' })
      return outcome
    })
    try {
      await started.promise
      await flushAsyncTasks()
      const startedBeforeRefresh = nextStarted
      release.resolve()
      await vi.waitFor(() => fails
        ? expect(loggerErrorMock).toHaveBeenCalledWith(failure)
        : expect(loggerSuccessMock).toHaveBeenCalledTimes(successLogs + 1))
      const outcome = await next
      const nextPlan = getHmrStyleUpdatePlan(ctx.configService)!
      const nextProfile = ctx.runtimeState.build.hmr.profile
      await onEvent({ code: 'END' })
      await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(2))

      expect(pendingPlan).toBe(firstPlan)
      expect(startedBeforeRefresh).toBe(false)
      expect(outcome).toBe(fails ? failure : undefined)
      expect(nextPlan.id).not.toBe(firstPlan!.id)
      expect(nextPlan.sourceFiles).toEqual(new Set(fails ? [firstFile, lateFile] : [lateFile]))
      expect(nextPlan.styleFiles).toEqual(new Set(fails ? [styleFile] : []))
      expect(nextPlan.compilerContentOwners).toEqual(new Map(fails ? [[firstFile, 'tailwind-content']] : []))
      expect(nextPlan.cssImporterOwners).toEqual(new Set(fails ? [firstFile] : []))
      expect(nextProfile.eventId).toBe('plugin-next')
      const samples = appendFileMock.mock.calls.map(call => JSON.parse(call[1]) as HmrProfileJsonSample)
      expect(samples.map(sample => sample.eventId)).toEqual(['plugin-first', 'plugin-next'])
      expect(samples.map(sample => sample.status)).toEqual([fails ? 'failed' : 'complete', 'complete'])
      expect(new Set(samples.map(sample => sample.buildId)).size).toBe(2)
      expect(ctx.runtimeState.build.hmr.profile).toEqual({})
      expect(getHmrStyleUpdatePlan(ctx.configService)).toBeUndefined()
    }
    finally {
      release.resolve()
      await next
      releaseFirst()
      releaseNext?.()
      await watcher.close()
    }
  })

  it.each([
    { refresh: 'page', full: false, profileWriteFails: false },
    { refresh: 'page', full: true, profileWriteFails: false },
    { refresh: 'app', full: false, profileWriteFails: false },
    { refresh: 'app', full: true, profileWriteFails: false },
    { refresh: 'page', full: false, profileWriteFails: true },
  ])('preserves source failure without premature success for $refresh refresh (full: $full, profile failure: $profileWriteFails)', async ({ refresh, full, profileWriteFails }) => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true, touchAppWxss: refresh === 'app' }
    const successLogs = loggerSuccessMock.mock.calls.length
    const refreshStarted = Promise.withResolvers<void>()
    const refreshResult = Promise.withResolvers<void>()
    const failure = Object.assign(new Error('style metadata denied'), { code: 'EACCES' })
    const profileFailure = new Error('profile storage denied')
    if (profileWriteFails) {
      appendFileMock.mockRejectedValueOnce(profileFailure)
    }
    if (refresh === 'page') {
      touchOutputStylesMock.mockImplementationOnce(async () => {
        refreshStarted.resolve()
        await refreshResult.promise
        return new Set<string>()
      })
    }
    else {
      touchMock.mockImplementationOnce(async () => {
        refreshStarted.resolve()
        await refreshResult.promise
      })
    }
    buildMock.mockImplementation(async () => {
      if (refresh === 'page') {
        ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add('pages/logs/index.wxss')
      }
      expect(ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh === true).toBe(full)
      return { output: [] }
    })
    const event = full ? 'create' : 'update'
    try {
      onChange({ event, file: HMR_PAGE_ID })
      await refreshStarted.promise
      await flushAsyncTasks()
      expect(appendFileMock).not.toHaveBeenCalled()
      expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(0)
      expect(loggerSuccessMock).toHaveBeenCalledTimes(successLogs)
      expect(ctx.runtimeState.build.hmr.profile.sourceEvents).toEqual([
        expect.objectContaining({ file: HMR_PAGE_ID, event }),
      ])
      refreshResult.reject(failure)
      await waitForMockCalls(appendFileMock, 1)
      await watcher.close()
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(appendFileMock).toHaveBeenCalledOnce()
      const sample = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
      expect(sample).toMatchObject({
        status: 'failed',
        correlation: 'known',
        buildId: expect.any(String),
        batchId: expect.any(String),
        sourceEvents: [expect.objectContaining({ file: HMR_PAGE_ID, event })],
      })
      expect(sample.totalMs).toBeUndefined()
      expect(sample.elapsedMs).toBeGreaterThanOrEqual(0)
      expect(ctx.runtimeState.build.hmr.profile).toEqual({})
      expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(0)
      expect(loggerSuccessMock).toHaveBeenCalledTimes(successLogs)
      expect(loggerErrorMock).toHaveBeenCalledWith(failure)
      expect(loggerErrorMock).not.toHaveBeenCalledWith(profileFailure)
    }
    finally {
      refreshResult.resolve()
      await watcher.close()
    }
  })

  it('records failed builds without treating their elapsed time as a completed sample', async () => {
    const { ctx, watcher } = await startClassicSnapshotContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    watcher.emit('START')
    watcher.emitPayload({ code: 'ERROR', error: new Error('syntax error') })
    await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(1))
    const sample = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
    expect(sample).toMatchObject({ schemaVersion: 1, pipeline: 'standard', status: 'failed' })
    expect(sample.totalMs).toBeUndefined()
    expect(sample.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(0)
    await watcher.close()
  })

  it('associates all source events with one snapshot batch and includes its completed duration', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    buildMock.mockResolvedValue({ output: [] })
    const files = ['index.ts', 'index.wxml', 'index.wxss', 'index.json'].map(file => `/project/src/pages/logs/${file}`)
    for (const file of files) {
      onChange({ event: 'update', file })
    }
    await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(1))
    const sample = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
    expect(sample.sourceEvents?.map(event => event.file)).toEqual(files)
    expect(new Set(sample.sourceEvents?.map(event => event.eventId)).size).toBe(4)
    expect(sample.batchId).toEqual(expect.any(String))
    expect(sample.snapshotBuildMs).toBeGreaterThanOrEqual(0)
    expect(sample.clock).toMatchObject({ durations: 'performance.now', timestamp: 'UTC' })
    await watcher.close()
  })

  it.each([
    { option: true, file: '/project/.weapp-vite/hmr-profile.jsonl' },
    { option: '.reports/hmr.jsonl', file: '/project/.reports/hmr.jsonl' },
  ])('does not schedule snapshots for generated profile events at $file', async ({ option, file }) => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    const { createDevModuleGraphPlugin } = await vi.importActual<typeof import('../../moduleGraph/devProvider')>('../../moduleGraph/devProvider')
    ctx.configService.weappViteConfig.hmr = { profileJson: option }
    ctx.moduleGraphService.hasModule.mockImplementation((id: string) => id === HMR_PAGE_ID)
    const observed = vi.fn(onChange)
    const plugin = createDevModuleGraphPlugin(ctx, {}, observed)
    const hotUpdate = plugin.hotUpdate as (this: unknown, options: { type: string, file: string, read: () => Promise<string> }) => Promise<void>
    const environment = { environment: { name: 'client' } }
    const read = vi.fn(async () => '{"status":"complete"}\n')
    buildMock.mockResolvedValue({ output: [] })
    const buildsBefore = buildMock.mock.calls.length
    vi.useFakeTimers()
    try {
      await hotUpdate.call(environment, { type: 'update', file, read })
      expect(read).not.toHaveBeenCalled()
      expect(observed).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)

      await hotUpdate.call(environment, { type: 'update', file: HMR_PAGE_ID, read: async () => 'Page({})' })
      expect(observed).toHaveBeenCalledExactlyOnceWith({ event: 'update', file: HMR_PAGE_ID })
      expect(vi.getTimerCount()).toBe(1)
      await hotUpdate.call(environment, { type: 'update', file, read })
      expect(observed).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(1)
      await vi.advanceTimersByTimeAsync(20)
      expect(buildMock).toHaveBeenCalledTimes(buildsBefore + 1)
      expect(appendFileMock).toHaveBeenCalledOnce()
      const sample = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
      expect(sample.sourceEvents?.map(event => event.file)).toEqual([HMR_PAGE_ID])

      for (const type of ['create', 'update', 'delete']) {
        await hotUpdate.call(environment, { type, file, read: async () => '{"status":"complete"}\n' })
      }
      expect(vi.getTimerCount()).toBe(0)
      await vi.advanceTimersByTimeAsync(20)
      expect(buildMock).toHaveBeenCalledTimes(buildsBefore + 1)
      expect(appendFileMock).toHaveBeenCalledOnce()
      expect(ctx.runtimeState.build.hmr.profile).toEqual({})
    }
    finally {
      await watcher.close()
      vi.useRealTimers()
    }
  })

  it.each(['building', 'published'] as const)('drains a consumed startup topology create without a second publication (%s)', async (arrival) => {
    const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'classic-initial-topology-'))))
    const file = path.join(root, 'pages/added/index.ts')
    const ctx = createMockContext()
    const release = startInitialBuildInputObservation(ctx.configService)
    const observation = getInitialBuildInputObservation(ctx.configService)!
    const filteredBatch = Promise.withResolvers<unknown[]>()
    const filter = observation.filter.bind(observation)
    const filtered = vi.spyOn(observation, 'filter').mockImplementation(async (changes) => {
      const retained = await filter(changes)
      filteredBatch.resolve(retained)
      return retained
    })
    let watcher: RolldownWatcher | undefined
    try {
      await fs.outputFile(file, 'Page({ data: { marker: "already-published" } })')
      Object.assign(ctx.configService, { cwd: root, absoluteSrcRoot: root, outDir: path.join(root, 'dist') })
      ctx.configService.weappViteConfig.autoRoutes = true
      ctx.autoRoutesService = {
        ensureFresh: vi.fn(async () => {}),
        getSignature: () => 'initial-route-generation',
        handleFileChange: vi.fn(async () => false),
      }
      ctx.runtimeState.build.hmr.resolvedEntryMap.set(file, { id: file })
      ctx.runtimeState.build.hmr.entriesMap.set(file, { path: file, type: 'page' })
      ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([file]))
      createManualWatcher()
      chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
      buildMock.mockImplementation(async () => {
        // 首构真实消费新增入口；迟到目录通知不能再次发布相同的输入代次。
        await readCompilerInput(ctx.configService, file)
        if (arrival === 'building' && buildMock.mock.calls.length === 1) {
          publishAutoRoutesTopology(ctx, { event: 'create', file, topologyChanged: true })
        }
        return { output: [] }
      })
      vi.useFakeTimers()
      watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
      expect(buildMock).toHaveBeenCalledOnce()
      if (arrival === 'published') {
        publishAutoRoutesTopology(ctx, { event: 'create', file, topologyChanged: false })
      }
      await vi.advanceTimersByTimeAsync(8)
      expect(await filteredBatch.promise).toEqual([])
      await flushAsyncTasks()
      expect(buildMock).toHaveBeenCalledOnce()
    }
    finally {
      filtered.mockRestore()
      vi.useRealTimers()
      await watcher?.close()
      release()
      await fs.remove(root)
    }
  })

  it('drains a late consumed startup update without rebuilding and still publishes new content and restoration', async () => {
    const root = path.normalize(realpathSync.native(await fs.mkdtemp(path.join(os.tmpdir(), 'classic-initial-input-'))))
    const file = path.join(root, 'app.json')
    const ctx = createMockContext()
    const release = startInitialBuildInputObservation(ctx.configService)
    const observation = getInitialBuildInputObservation(ctx.configService)!
    const published: string[] = []
    let watcher: RolldownWatcher | undefined
    try {
      await fs.writeFile(file, '{"pages":[]}')
      // 等价于 validateEntries 的真实消费，观察期先于首构开始。
      await readCompilerInput(ctx.configService, file)
      Object.assign(ctx.configService, { cwd: root, absoluteSrcRoot: root, outDir: path.join(root, 'dist') })
      ctx.runtimeState.build.hmr.resolvedEntryMap.set(HMR_PAGE_ID, { id: HMR_PAGE_ID })
      ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([HMR_PAGE_ID]))
      createManualWatcher()
      chokidarWatchMock.mockReturnValueOnce(createManualSidecarWatcher())
      buildMock.mockImplementation(async () => {
        published.push(await readCompilerInput(ctx.configService, file))
        return { output: [] }
      })
      watcher = await createBuildService(ctx).build({ skipNpm: true }) as RolldownWatcher
      expect(buildMock).toHaveBeenCalledOnce()
      const { createDevModuleGraphPlugin } = await vi.importActual<typeof import('../../moduleGraph/devProvider')>('../../moduleGraph/devProvider')
      const plugin = createDevModuleGraphPlugin(ctx, {}, moduleGraphProviderChange.handler!)
      const hotUpdate = plugin.hotUpdate as (this: unknown, options: { type: string, file: string, read: () => Promise<string> }) => Promise<void>
      const filter = observation.filter.bind(observation)
      let handled = Promise.withResolvers<void>()
      const filtered = vi.spyOn(observation, 'filter').mockImplementation(async (changes) => {
        try {
          return await filter(changes)
        }
        finally {
          handled.resolve()
        }
      })
      vi.useFakeTimers()
      const update = async (source: string) => {
        await fs.writeFile(file, source)
        handled = Promise.withResolvers<void>()
        await hotUpdate.call({ environment: { name: 'client' } }, { type: 'update', file, read: async () => await fs.readFile(file, 'utf8') })
        chokidarWatchMock.mock.results.at(-1)!.value.emit('change', file)
        await vi.advanceTimersByTimeAsync(8)
        // 实际批次的输入检查已完成，随后清空同一串行任务的微任务；不靠 close 抢走计时器。
        await handled.promise
        await flushAsyncTasks()
      }
      try {
        await update('{"pages":[]}')
        expect(await filtered.mock.results[0]!.value).toEqual([])
        expect(buildMock).toHaveBeenCalledOnce()
        await update('{"pages":["changed"]}')
        await vi.waitFor(() => expect(published).toEqual(['{"pages":[]}', '{"pages":["changed"]}']))
        expect(buildMock).toHaveBeenCalledTimes(2)
        await update('{"pages":[]}')
        await vi.waitFor(() => expect(published).toEqual(['{"pages":[]}', '{"pages":["changed"]}', '{"pages":[]}']))
        expect(buildMock).toHaveBeenCalledTimes(3)
      }
      finally {
        filtered.mockRestore()
        vi.useRealTimers()
      }
    }
    finally {
      await watcher?.close()
      release()
      await fs.remove(root)
    }
  })

  it.each([
    { option: true, env: undefined },
    { option: '.reports/hmr.jsonl', env: undefined },
    { option: true, env: '.observations/hmr.jsonl' },
  ])('does not retry a failed initial snapshot when its own failure profile changes: $option / $env', async ({ option, env }) => {
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: option }
    if (env) {
      process.env.WEAPP_VITE_HMR_PROFILE_JSON = env
    }
    ctx.moduleGraphService.hasModule.mockImplementation((id: string) => id === HMR_PAGE_ID)
    const watcher = createManualWatcher()
    chokidarWatchMock.mockReturnValue(createManualSidecarWatcher())
    const detach = attachDevModuleGraphHost(ctx, {} as ViteDevServer)
    buildMock.mockRejectedValue(new Error('source still invalid'))
    const { createDevModuleGraphPlugin } = await vi.importActual<typeof import('../../moduleGraph/devProvider')>('../../moduleGraph/devProvider')
    try {
      await createBuildService(ctx).build({ skipNpm: true })
      await watcher.subscribed
      const plugin = createDevModuleGraphPlugin(ctx, {}, moduleGraphProviderChange.handler!)
      const hotUpdate = plugin.hotUpdate as (this: unknown, options: { type: string, file: string, read: () => Promise<string> }) => Promise<void>
      const environment = { environment: { name: 'client' } }
      vi.useFakeTimers()
      await hotUpdate.call(environment, { type: 'update', file: HMR_PAGE_ID, read: async () => 'invalid source' })
      await vi.advanceTimersByTimeAsync(20)
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(appendFileMock).toHaveBeenCalledOnce()
      const failedProfile = JSON.parse(appendFileMock.mock.calls[0][1]) as HmrProfileJsonSample
      expect(failedProfile.status).toBe('failed')
      const profileFile = appendFileMock.mock.calls[0][0]
      await hotUpdate.call(environment, { type: 'update', file: profileFile, read: async () => appendFileMock.mock.calls[0][1] })
      await vi.advanceTimersByTimeAsync(20)
      expect(buildMock).toHaveBeenCalledTimes(2)
      expect(appendFileMock).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      await watcher.close()
      detach()
      vi.useRealTimers()
    }
  })

  it('records an unaffected source batch without carrying its profile into a later build', async () => {
    const { ctx, watcher, onChange } = await startClassicSnapshotContext()
    ctx.configService.weappViteConfig.hmr = { profileJson: true }
    vi.mocked(ctx.moduleGraphService.collectAffectedEntries).mockReturnValue(new Set())
    onChange({ event: 'update', file: '/project/src/unreferenced.ts' })
    await vi.waitFor(() => expect(appendFileMock).toHaveBeenCalledTimes(1))
    const sample = JSON.parse(appendFileMock.mock.calls[0][1]) as Record<string, unknown>
    expect(sample).toMatchObject({ status: 'incomplete', reason: 'no-affected-entries' })
    expect(sample.totalMs).toBeUndefined()
    expect(sample.buildCoreMs).toBeUndefined()
    expect(sample.sourceEvents).toEqual([expect.objectContaining({ file: '/project/src/unreferenced.ts' })])
    expect(ctx.runtimeState.build.hmr.profile).toEqual({})
    expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(0)
    await watcher.close()
  })

  it('writes hmr profile jsonl with default output path when enabled', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(100)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      eventId: 'hmr-event-1',
      finalizePrepareMs: 0.1,
      tailwindPrepareMs: 0,
      tailwindGenerateMs: 1.1,
      tailwindCssMs: 1.2,
      tailwindTemplateMs: 1.3,
      tailwindJavaScriptMs: 1.4,
      tailwindFinalizeMs: 1.5,
      tailwindSourceResolveMs: 0.7,
      tailwindDiskGenerateMs: 0.8,
      finalizeTemplateMs: 0.2,
      finalizePublishMs: 0.3,
      publicationValidateMs: 0.4,
      publicationIndependentMs: 0.5,
      publicationPruneMs: 0.6,
      file: '/project/src/pages/logs/index.vue',
      event: 'update',
      buildStartMs: 4,
      pluginResolveMs: 2,
      transformMs: 9.5,
      coreTransformMs: 2.5,
      wevuTransformMs: 3,
      vueTransformMs: 4,
      vueReadSourceMs: 0.5,
      vueCompileMs: 2,
      vueFinalizeCompiledMs: 0.75,
      vueFinalizeCodeMs: 0.75,
      coreLoadMs: 4,
      entryLoadMs: 2.5,
      requestGlobalsMs: 1,
      weapiResolveMs: 0.5,
      renderStartMs: 6,
      generateBundleMs: 11,
      generateSharedMs: 3,
      generateRewriteMs: 7,
      generateModuleGraphMs: 1,
      writeMs: 5.25,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
      sharedChunkResolveMs: 1.75,
      entryChunkLoadMs: 6.5,
      entryChunkEmitFileMs: 0.75,
      chunkEmitCount: 3,
      loadCount: 2,
      resolveCount: 5,
      skippedLoadedCount: 1,
      dirtyCount: 2,
      pendingCount: 2,
      emittedCount: 2,
      dirtyReasonSummary: ['entry-direct:1'],
      pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(appendFileMock).toHaveBeenCalledTimes(1)
    })

    expect(mkdirMock).toHaveBeenCalledWith('/project/.weapp-vite', { recursive: true })
    expect(appendFileMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/hmr-profile.jsonl',
      expect.stringMatching(/"file":"\/project\/src\/pages\/logs\/index\.vue"/),
      'utf8',
    )
    const [, payload] = appendFileMock.mock.calls[0]
    expect(typeof payload).toBe('string')
    expect(payload.endsWith('\n')).toBe(true)
    expect(payload).toContain('"event":"update"')
    expect(payload).toContain('"eventId":"hmr-event-1"')
    expect(JSON.parse(payload) as HmrProfileJsonSample).toMatchObject({
      tailwindPrepareMs: 0,
      tailwindGenerateMs: 1.1,
      tailwindCssMs: 1.2,
      tailwindTemplateMs: 1.3,
      tailwindJavaScriptMs: 1.4,
      tailwindFinalizeMs: 1.5,
      tailwindSourceResolveMs: 0.7,
      tailwindDiskGenerateMs: 0.8,
    })
    expect(payload).toContain('"finalizePrepareMs":0.1')
    expect(payload).toContain('"finalizeTemplateMs":0.2')
    expect(payload).toContain('"finalizePublishMs":0.3')
    expect(payload).toContain('"publicationValidateMs":0.4')
    expect(payload).toContain('"publicationIndependentMs":0.5')
    expect(payload).toContain('"publicationPruneMs":0.6')
    expect(payload).toContain('"relativeFile":"src/pages/logs/index.vue"')
    expect(payload).toContain('"sourceRootFile":"pages/logs/index.vue"')
    expect(payload).toContain('"buildStartMs":4')
    expect(payload).toContain('"pluginResolveMs":2')
    expect(payload).toContain('"transformMs":9.5')
    expect(payload).toContain('"coreTransformMs":2.5')
    expect(payload).toContain('"wevuTransformMs":3')
    expect(payload).toContain('"vueTransformMs":4')
    expect(payload).toContain('"vueReadSourceMs":0.5')
    expect(payload).toContain('"vueCompileMs":2')
    expect(payload).toContain('"vueFinalizeCompiledMs":0.75')
    expect(payload).toContain('"vueFinalizeCodeMs":0.75')
    expect(payload).toContain('"coreLoadMs":4')
    expect(payload).toContain('"entryLoadMs":2.5')
    expect(payload).toContain('"requestGlobalsMs":1')
    expect(payload).toContain('"weapiResolveMs":0.5')
    expect(payload).toContain('"renderStartMs":6')
    expect(payload).toContain('"generateBundleMs":11')
    expect(payload).toContain('"generateSharedMs":3')
    expect(payload).toContain('"generateRewriteMs":7')
    expect(payload).toContain('"generateModuleGraphMs":1')
    expect(payload).toContain('"bundlerMs":')
    expect(payload).toContain('"writeMs":5.25')
    expect(payload).toContain('"buildCoreMs":30.5')
    expect(payload).toContain('"entryChunkLoadMs":6.5')
    expect(payload).toContain('"entryChunkEmitFileMs":0.75')
    expect(payload).toContain('"chunkEmitCount":3')
    expect(payload).toContain('"loadCount":2')
    expect(payload).toContain('"resolveCount":5')
    expect(payload).toContain('"skippedLoadedCount":1')
    expect(payload).toContain('"dirtyReasonSummary":["entry-direct:1"]')
    expect(payload).toContain('"pendingReasonSummary":["shared-chunk(common.js)+1:direct"]')
    nowSpy.mockRestore()
  })

  it('writes hmr profile jsonl to custom relative path', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: '.reports/hmr.jsonl',
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      event: 'create',
      dirtyCount: 1,
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(appendFileMock).toHaveBeenCalledTimes(1)
    })

    expect(mkdirMock).toHaveBeenCalledWith('/project/.reports', { recursive: true })
    expect(appendFileMock).toHaveBeenCalledWith(
      '/project/.reports/hmr.jsonl',
      expect.stringContaining('"event":"create"'),
      'utf8',
    )
  })

  it('does not write hmr profile jsonl when disabled', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      event: 'update',
      dirtyCount: 1,
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalled()
    })

    expect(mkdirMock).not.toHaveBeenCalled()
    expect(appendFileMock).not.toHaveBeenCalled()
  })

  it('writes hmr profile jsonl when env flag enables output', async () => {
    process.env.WEAPP_VITE_HMR_PROFILE_JSON = '1'
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      event: 'update',
      dirtyCount: 1,
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(appendFileMock).toHaveBeenCalledTimes(1)
    })

    expect(appendFileMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/hmr-profile.jsonl',
      expect.stringContaining('"event":"update"'),
      'utf8',
    )
  })

  it('prints analyze hint when hmr profile is enabled and rebuild becomes much slower', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    for (const totalMs of [100, 80, 90, 200]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      nowValue = cursor
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    await waitForMockCalls(loggerInfoMock, 1)
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('weapp-vite analyze --hmr-profile'))
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('当前 200.00 ms'))
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('疑似慢段 emit 100.00 ms'))
    nowSpy.mockRestore()
  })

  it('does not print analyze hint when hmr profile output is disabled', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    for (const totalMs of [100, 80, 90, 200]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      nowValue = cursor
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    expect(loggerInfoMock.mock.calls.flat().join('\n')).not.toContain('疑似慢段')
    nowSpy.mockRestore()
  })

  it('suppresses repeated slow hmr hints until enough new samples accumulate', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    for (const totalMs of [100, 80, 90, 200, 210, 220]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      nowValue = cursor
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    expect(loggerInfoMock.mock.calls.filter(([message]) => String(message).includes('疑似慢段'))).toHaveLength(1)
    nowSpy.mockRestore()
  })

  it('prefers shared phase hint when shared chunk cost regresses most', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    const durations = [100, 80, 90, 200]
    for (const { profile, totalMs } of [
      { emitMs: 20, sharedChunkResolveMs: 6 },
      { emitMs: 22, sharedChunkResolveMs: 7 },
      { emitMs: 24, sharedChunkResolveMs: 8 },
      { emitMs: 26, sharedChunkResolveMs: 90 },
    ].map((profile, index) => ({ profile, totalMs: durations[index] }))) {
      nowValue = cursor
      ctx.runtimeState.build.hmr.profile = profile
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    await waitForMockCalls(loggerInfoMock, 1)
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('疑似慢段 shared 90.00 ms'))
    nowSpy.mockRestore()
  })

  it('skips npm build when skipNpm is enabled and hmr touch is false', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        weappViteConfig: {
          hmr: {
            touchAppWxss: false,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(ctx.npmService.build).not.toHaveBeenCalled()
    expect(touchMock).not.toHaveBeenCalled()
  })

  it.each([true, false])('preserves startup output and caches with emptyOutDir=false in dev=%s', async (isDev) => {
    buildMock.mockResolvedValue(isDev ? createWatcher(['START', 'END']) : { output: [] })
    const ctx = createMockContext()
    ctx.configService.isDev = isDev
    ctx.configService.inlineConfig = { build: { emptyOutDir: false } }
    ctx.configService.weappViteConfig.cleanOutputsInDev = true
    await createBuildService(ctx).build({ skipNpm: true })
    expect(cleanOutputsMock).not.toHaveBeenCalled()
    expect(resetEmittedOutputCachesMock).not.toHaveBeenCalled()
  })

  it('delegates production plugin options to the publication stage', async () => {
    buildMock.mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    Object.assign(ctx.configService, {
      isDev: false,
      inlineConfig: { build: { emptyOutDir: false } },
      absolutePluginRoot: '/project/plugin',
      absolutePluginOutputRoot: '/project/dist-plugin',
    })
    await createBuildService(ctx).build({ skipNpm: true })
    expect(setPluginProjectBuildOptionsMock).toHaveBeenCalledWith(ctx, { skipNpm: true })
    expect(createPluginProjectSessionMock).not.toHaveBeenCalled()
  })

  it('skips output cleanup in dev when cleanOutputsInDev is false', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          cleanOutputsInDev: false,
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build()

    expect(cleanOutputsMock).not.toHaveBeenCalled()
    expect(syncProjectConfigToOutputMock).not.toHaveBeenCalled()
  })

  it('cleans output in dev when cleanOutputsInDev is true', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          cleanOutputsInDev: true,
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build()

    expect(cleanOutputsMock).toHaveBeenCalledTimes(1)
    expect(resetEmittedOutputCachesMock).toHaveBeenCalledWith(ctx.runtimeState)
  })

  it('reuses npm cache in dev mode when dependencies are not outdated', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    ctx.runtimeState.build.npmBuilt = true
    ctx.npmService.checkDependenciesCacheOutdate.mockResolvedValueOnce(false)
    const service = createBuildService(ctx)

    await service.build()

    expect(ctx.npmService.build).not.toHaveBeenCalled()
    expect(ctx.npmService.checkDependenciesCacheOutdate).toHaveBeenCalledTimes(1)
  })

  it('rejects dev build when the initial one-shot build fails', async () => {
    const buildError = new Error('initial build failed')
    buildMock.mockRejectedValueOnce(buildError)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    await expect(service.build({ skipNpm: true })).rejects.toBe(buildError)
    expect(ctx.watcherService.setRollupWatcher).not.toHaveBeenCalled()
  })

  it('runs prod app and plugin builds with workers and npm scheduling', async () => {
    process.env.VITEST = 'false'
    process.env.NODE_ENV = 'production'

    checkWorkersOptionsMock.mockImplementation((target: string) => {
      if (target === 'app') {
        return {
          hasWorkersDir: true,
          workersDir: 'workers',
        }
      }
      return {
        hasWorkersDir: false,
        workersDir: undefined,
      }
    })
    buildMock
      .mockResolvedValueOnce({ output: [] })
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        isDev: false,
        absolutePluginRoot: '/project/src/plugin',
        absolutePluginOutputRoot: '/project/dist-plugin',
        multiPlatform: {
          enabled: true,
          projectConfigRoot: 'config',
          targets: ALL_MP_PLATFORMS,
        },
        weappViteConfig: {
          multiPlatform: true,
        },
      },
    })
    const queueStartSpy = vi.spyOn(ctx.runtimeState.build.queue, 'start')
    const service = createBuildService(ctx)

    await service.build()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(buildMock).toHaveBeenNthCalledWith(1, {})
    expect(createPluginProjectSessionMock).not.toHaveBeenCalled()
    expect(setPluginProjectBuildOptionsMock).toHaveBeenCalledWith(ctx, {})
    expect(queueStartSpy).toHaveBeenCalled()
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)
    expect(syncProjectConfigToOutputMock).not.toHaveBeenCalled()
  })

  it('runs prod bundler without waiting for local subpackage npm preload', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })
    let releaseNpmBuild: (() => void) | undefined

    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        isDev: false,
        weappViteConfig: {
          npm: {
            enable: true,
            subPackages: {
              packageA: {
                dependencies: ['dayjs'],
              },
            },
          },
        },
      },
    })
    ctx.npmService.build.mockImplementationOnce(async () => {
      await ctx.scanService.loadAppEntry()
      ctx.scanService.loadSubPackages()
      await new Promise<void>((resolve) => {
        releaseNpmBuild = resolve
      })
    })
    const service = createBuildService(ctx)

    const buildPromise = service.build()
    await waitForMockCalls(buildMock, 1)

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)

    let resolved = false
    buildPromise.then(() => {
      resolved = true
    }).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(resolved).toBe(false)

    releaseNpmBuild?.()
    await buildPromise
    expect(resolved).toBe(true)
  })

  it('preloads app entry before prod build when worker entry config needs workersDir', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        isDev: false,
        weappViteConfig: {
          worker: {
            entry: ['index'],
          },
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.npmService.build).not.toHaveBeenCalled()
  })

  it('runs isolated plugin watcher in dev mode and registers it on main watcher service', async () => {
    const pluginWatcher = createWatcher(['START', 'END'])
    buildMock.mockReset()
    vueStyleSnapshotMock.mockReset().mockImplementation(runVueStyleSnapshotMock)
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const closePlugin = vi.fn(async () => {})
    createPluginProjectSessionMock.mockResolvedValueOnce({
      context: { buildService: { build: vi.fn(async () => pluginWatcher) } },
      run: async task => await task(),
      close: closePlugin,
    })

    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        absolutePluginRoot: '/project/plugin',
        absolutePluginOutputRoot: '/project/dist-plugin',
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(createPluginProjectSessionMock).toHaveBeenCalledWith(ctx)
    const child = ctx.watcherService.sidecarWatcherMap.get('plugin-session:/project/plugin')
    expect(child).toBeDefined()
    await child!.close()
    expect(closePlugin).toHaveBeenCalledOnce()
  })

  it('delegates prod lib publication to the native plugin chain without CLI-only dts/npm tasks', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        isDev: false,
        absolutePluginRoot: '/project/src/plugin',
        weappLibConfig: {
          enabled: true,
          dts: {
            enabled: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(generateLibDtsMock).not.toHaveBeenCalled()
    expect(syncProjectConfigToOutputMock).not.toHaveBeenCalled()
    expect(ctx.npmService.build).not.toHaveBeenCalled()
  })

  it('runs plugin target directly in pluginOnly mode', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

    const ctx = createMockContext({
      currentBuildTarget: 'app',
      configService: {
        ...createMockContext().configService,
        isDev: false,
        pluginOnly: true,
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(ctx.currentBuildTarget).toBe('plugin')
    expect(createPluginProjectSessionMock).not.toHaveBeenCalled()
    expect(ctx.npmService.build).not.toHaveBeenCalled()
  })

  it('exposes independent builder methods from createIndependentBuilder', async () => {
    const ctx = createMockContext()
    const service = createBuildService(ctx)
    const meta = {
      subPackage: {
        root: 'pkg',
      },
    } as any

    await service.buildIndependentBundle('pkg', meta)
    service.getIndependentOutput('pkg')
    service.invalidateIndependentOutput('pkg')

    expect(independentBuildMock).toHaveBeenCalledWith('pkg', meta)
    expect(independentGetOutputMock).toHaveBeenCalledWith('pkg')
    expect(independentInvalidateMock).toHaveBeenCalledWith('pkg')
  })
})
