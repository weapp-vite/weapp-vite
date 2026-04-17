import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MP_PLATFORM } from '../../../../platform'
import { emitFallbackPageAssets, emitResolvedFallbackPageEntryAssets } from './emitFallbackPage'

const DEFAULT_PLATFORM_ASSET_OPTIONS = {
  platform: DEFAULT_MP_PLATFORM,
  templateExtension: 'wxml',
  scriptModuleExtension: 'wxs',
}

const loggerErrorMock = vi.hoisted(() => vi.fn())
const collectFallbackPageEntryIdsMock = vi.hoisted(() => vi.fn(async () => []))
const pathExistsMock = vi.hoisted(() => vi.fn(async () => false))
const loadFallbackPageEntryCompilationMock = vi.hoisted(() => vi.fn(async () => ({
  source: '<template />',
  result: { template: '<view />' },
})))
const handleFallbackPageLayoutsMock = vi.hoisted(() => vi.fn(async ({ emitLayouts }: any) => {
  await emitLayouts([{ kind: 'vue', file: '/project/src/layouts/default.vue' }])
}))
const emitFallbackPageBundleAssetsMock = vi.hoisted(() => vi.fn())
const resolveFallbackPageEmitStateMock = vi.hoisted(() => vi.fn(async () => undefined))
const addBundleWatchFileMock = vi.hoisted(() => vi.fn())
const resolveVueBundleAssetContextMock = vi.hoisted(() => vi.fn(() => ({
  outputExtensions: { wxml: 'wxml' },
  templateExtension: 'wxml',
  styleExtension: 'wxss',
  jsonExtension: 'json',
  scriptModuleExtension: 'wxs',
  platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
})))
const emitBundlePageLayoutsIfNeededMock = vi.hoisted(() => vi.fn(async () => {}))
const getPathExistsTtlMsMock = vi.hoisted(() => vi.fn(() => 50))

vi.mock('../../../../logger', () => ({
  default: {
    error: loggerErrorMock,
  },
}))

vi.mock('../../../../utils/cachePolicy', () => ({
  getPathExistsTtlMs: getPathExistsTtlMsMock,
}))

vi.mock('../../../utils/cache', () => ({
  pathExists: pathExistsMock,
}))

vi.mock('../fallbackEntries', () => ({
  collectFallbackPageEntryIds: collectFallbackPageEntryIdsMock,
}))

vi.mock('./layoutAssets', () => ({
  emitBundlePageLayoutsIfNeeded: emitBundlePageLayoutsIfNeededMock,
}))

vi.mock('./shared', () => ({
  addBundleWatchFile: addBundleWatchFileMock,
  emitFallbackPageBundleAssets: emitFallbackPageBundleAssetsMock,
  handleFallbackPageLayouts: handleFallbackPageLayoutsMock,
  loadFallbackPageEntryCompilation: loadFallbackPageEntryCompilationMock,
  resolveFallbackPageEmitState: resolveFallbackPageEmitStateMock,
  resolveVueBundleAssetContext: resolveVueBundleAssetContextMock,
}))

describe('emitFallbackPage helpers', () => {
  beforeEach(() => {
    loggerErrorMock.mockReset()
    collectFallbackPageEntryIdsMock.mockReset()
    collectFallbackPageEntryIdsMock.mockResolvedValue([])
    pathExistsMock.mockReset()
    pathExistsMock.mockResolvedValue(false)
    loadFallbackPageEntryCompilationMock.mockReset()
    loadFallbackPageEntryCompilationMock.mockResolvedValue({
      source: '<template />',
      result: { template: '<view />' },
    })
    handleFallbackPageLayoutsMock.mockReset()
    handleFallbackPageLayoutsMock.mockImplementation(async ({ emitLayouts }: any) => {
      await emitLayouts([{ kind: 'vue', file: '/project/src/layouts/default.vue' }])
    })
    emitFallbackPageBundleAssetsMock.mockReset()
    resolveFallbackPageEmitStateMock.mockReset()
    resolveFallbackPageEmitStateMock.mockResolvedValue(undefined)
    addBundleWatchFileMock.mockReset()
    resolveVueBundleAssetContextMock.mockReset()
    resolveVueBundleAssetContextMock.mockReturnValue({
      outputExtensions: { wxml: 'wxml' },
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })
    emitBundlePageLayoutsIfNeededMock.mockReset()
    emitBundlePageLayoutsIfNeededMock.mockResolvedValue(undefined)
    getPathExistsTtlMsMock.mockReset()
    getPathExistsTtlMsMock.mockReturnValue(50)
  })

  it('emits a resolved fallback page entry through shared layout and asset flow', async () => {
    const bundle = {}
    const pluginCtx = { emitFile: vi.fn() }
    const ctx = {}
    const configService = { platform: DEFAULT_MP_PLATFORM }
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }

    await emitResolvedFallbackPageEntryAssets({
      bundle,
      pluginCtx,
      ctx: ctx as any,
      entryFilePath: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      configService: configService as any,
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(loadFallbackPageEntryCompilationMock).toHaveBeenCalledWith({
      entryFilePath: '/project/src/pages/index/index.vue',
      ctx,
      pluginCtx,
      configService,
      compileOptionsState,
    })
    expect(handleFallbackPageLayoutsMock).toHaveBeenCalledTimes(1)
    expect(emitBundlePageLayoutsIfNeededMock).toHaveBeenCalledWith({
      layouts: [{ kind: 'vue', file: '/project/src/layouts/default.vue' }],
      pluginCtx,
      bundle,
      ctx,
      configService,
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' },
    })
    expect(emitFallbackPageBundleAssetsMock).toHaveBeenCalledWith({
      bundle,
      pluginCtx,
      ctx,
      filename: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      result: { template: '<view />' },
      configService,
      templateExtension: 'wxml',
      styleExtension: 'wxss',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions: { wxml: 'wxml' },
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })
  })

  it('iterates resolved fallback pages through the shared entry emitter', async () => {
    const state = {
      ctx: {
        configService: { platform: DEFAULT_MP_PLATFORM },
        scanService: {},
      },
      pluginCtx: {},
      compilationCache: new Map(),
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any

    collectFallbackPageEntryIdsMock.mockResolvedValue(['/pages/index'])
    resolveFallbackPageEmitStateMock.mockImplementation(async ({ pathExists }: any) => {
      expect(await pathExists('/project/src/pages/index/index.vue')).toBeUndefined()
      pathExistsMock.mockResolvedValueOnce(true)
      expect(await pathExists('/project/src/pages/index/index.vue')).toBe('/project/src/pages/index/index.vue')
      return {
        relativeBase: 'pages/index/index',
        entryFilePath: '/project/src/pages/index/index.vue',
      }
    })

    await emitFallbackPageAssets({}, state)

    expect(resolveVueBundleAssetContextMock).toHaveBeenCalledWith(state.ctx.configService)
    expect(addBundleWatchFileMock).toHaveBeenCalledWith({}, '/project/src/pages/index/index.vue')
    expect(loadFallbackPageEntryCompilationMock).toHaveBeenCalledTimes(1)
    expect(emitFallbackPageBundleAssetsMock).toHaveBeenCalledTimes(1)
  })

  it('skips unresolved fallback page entries', async () => {
    const state = {
      ctx: {
        configService: { platform: DEFAULT_MP_PLATFORM },
        scanService: {},
      },
      pluginCtx: {},
      compilationCache: new Map(),
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any

    collectFallbackPageEntryIdsMock.mockResolvedValue(['/pages/index'])
    resolveFallbackPageEmitStateMock.mockResolvedValue(undefined)

    await emitFallbackPageAssets({}, state)

    expect(addBundleWatchFileMock).not.toHaveBeenCalled()
    expect(loadFallbackPageEntryCompilationMock).not.toHaveBeenCalled()
  })

  it('logs fallback page compilation failures and continues', async () => {
    const state = {
      ctx: {
        configService: { platform: DEFAULT_MP_PLATFORM },
        scanService: {},
      },
      pluginCtx: {},
      compilationCache: new Map(),
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any

    collectFallbackPageEntryIdsMock.mockResolvedValue(['/pages/index'])
    resolveFallbackPageEmitStateMock.mockResolvedValue({
      relativeBase: 'pages/index/index',
      entryFilePath: '/project/src/pages/index/index.vue',
    })
    loadFallbackPageEntryCompilationMock.mockRejectedValue(new Error('boom'))

    await emitFallbackPageAssets({}, state)

    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[Vue 编译] 编译 /project/src/pages/index/index.vue 失败：boom',
    )
  })

  it('returns early when required services are missing', async () => {
    await emitFallbackPageAssets({}, {
      ctx: {},
      pluginCtx: {},
      compilationCache: new Map(),
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any)

    expect(resolveVueBundleAssetContextMock).not.toHaveBeenCalled()
    expect(collectFallbackPageEntryIdsMock).not.toHaveBeenCalled()
  })
})
