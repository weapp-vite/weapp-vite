import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitCompiledVueEntryAssets, emitResolvedCompiledVueEntryAssets } from './emitCompiledEntry'

const addBundleWatchFileMock = vi.hoisted(() => vi.fn())
const emitCompiledEntryBundleAssetsMock = vi.hoisted(() => vi.fn(() => ({
  shouldEmitComponentJson: false,
})))
const handleCompiledEntryPageLayoutsMock = vi.hoisted(() => vi.fn(async ({ emitLayouts }: any) => {
  await emitLayouts([{ kind: 'native', file: '/project/src/layouts/default' }])
}))
const resolveCompiledEntryEmitStateMock = vi.hoisted(() => vi.fn(async () => undefined))
const resolveVueBundleAssetContextMock = vi.hoisted(() => vi.fn(() => ({
  outputExtensions: { wxml: 'wxml' },
  templateExtension: 'wxml',
  jsonExtension: 'json',
  scriptExtension: 'js',
  scriptModuleExtension: 'wxs',
  platformAssetOptions: {
    platform: 'wechat',
    templateExtension: 'wxml',
    scriptModuleExtension: 'wxs',
  },
})))
const emitBundlePageLayoutsIfNeededMock = vi.hoisted(() => vi.fn(async () => {}))
const emitScriptlessComponentJsFallbackIfMissingMock = vi.hoisted(() => vi.fn())

vi.mock('./layoutAssets', () => ({
  emitBundlePageLayoutsIfNeeded: emitBundlePageLayoutsIfNeededMock,
  emitScriptlessComponentJsFallbackIfMissing: emitScriptlessComponentJsFallbackIfMissingMock,
}))

vi.mock('./shared', () => ({
  addBundleWatchFile: addBundleWatchFileMock,
  emitCompiledEntryBundleAssets: emitCompiledEntryBundleAssetsMock,
  handleCompiledEntryPageLayouts: handleCompiledEntryPageLayoutsMock,
  resolveCompiledEntryEmitState: resolveCompiledEntryEmitStateMock,
  resolveVueBundleAssetContext: resolveVueBundleAssetContextMock,
}))

describe('emitCompiledEntry helpers', () => {
  beforeEach(() => {
    addBundleWatchFileMock.mockReset()
    emitCompiledEntryBundleAssetsMock.mockReset()
    emitCompiledEntryBundleAssetsMock.mockReturnValue({
      shouldEmitComponentJson: false,
    })
    handleCompiledEntryPageLayoutsMock.mockReset()
    handleCompiledEntryPageLayoutsMock.mockImplementation(async ({ emitLayouts }: any) => {
      await emitLayouts([{ kind: 'native', file: '/project/src/layouts/default' }])
    })
    resolveCompiledEntryEmitStateMock.mockReset()
    resolveCompiledEntryEmitStateMock.mockResolvedValue(undefined)
    resolveVueBundleAssetContextMock.mockReset()
    resolveVueBundleAssetContextMock.mockReturnValue({
      outputExtensions: { wxml: 'wxml' },
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: {
        platform: 'wechat',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })
    emitBundlePageLayoutsIfNeededMock.mockReset()
    emitBundlePageLayoutsIfNeededMock.mockResolvedValue(undefined)
    emitScriptlessComponentJsFallbackIfMissingMock.mockReset()
  })

  it('emits resolved compiled page entries through shared layout flow', async () => {
    const bundle = {}
    const state = {
      ctx: {
        configService: { platform: 'wechat' },
      },
      pluginCtx: {},
    } as any
    const cached = {
      isPage: true,
      source: '<template />',
    } as any
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }
    const result = { template: '<view />', script: 'Page({})' } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle,
      state,
      filename: '/project/src/pages/index/index.vue',
      cached,
      result,
      relativeBase: 'pages/index/index',
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: {
        platform: 'wechat',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(handleCompiledEntryPageLayoutsMock).toHaveBeenCalledTimes(1)
    expect(emitBundlePageLayoutsIfNeededMock).toHaveBeenCalledWith({
      layouts: [{ kind: 'native', file: '/project/src/layouts/default' }],
      pluginCtx: {},
      bundle,
      ctx: state.ctx,
      configService: state.ctx.configService,
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' },
    })
    expect(emitCompiledEntryBundleAssetsMock).toHaveBeenCalledWith({
      bundle,
      pluginCtx: {},
      ctx: state.ctx,
      filename: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      result,
      isPage: true,
      configService: state.ctx.configService,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions: { wxml: 'wxml' },
      platformAssetOptions: {
        platform: 'wechat',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })
    expect(emitScriptlessComponentJsFallbackIfMissingMock).not.toHaveBeenCalled()
  })

  it('emits scriptless component fallbacks for component entries without script', async () => {
    emitCompiledEntryBundleAssetsMock.mockReturnValue({
      shouldEmitComponentJson: true,
    })

    await emitResolvedCompiledVueEntryAssets({
      bundle: {},
      state: {
        ctx: {
          configService: { platform: 'wechat' },
        },
        pluginCtx: {},
      } as any,
      filename: '/project/src/components/card.vue',
      cached: {
        isPage: false,
      } as any,
      result: {
        template: '<view />',
        script: '   ',
      } as any,
      relativeBase: 'components/card',
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: {
        platform: 'wechat',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(handleCompiledEntryPageLayoutsMock).not.toHaveBeenCalled()
    expect(emitScriptlessComponentJsFallbackIfMissingMock).toHaveBeenCalledWith({
      pluginCtx: {},
      bundle: {},
      relativeBase: 'components/card',
      scriptExtension: 'js',
    })
  })

  it('returns early for resolved compiled entry emission when config service is missing', async () => {
    await emitResolvedCompiledVueEntryAssets({
      bundle: {},
      state: {
        ctx: {},
        pluginCtx: {},
      } as any,
      filename: '/project/src/components/card.vue',
      cached: {
        isPage: false,
      } as any,
      result: {
        template: '<view />',
        script: '',
      } as any,
      relativeBase: 'components/card',
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: {
        platform: 'wechat',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(handleCompiledEntryPageLayoutsMock).not.toHaveBeenCalled()
    expect(emitCompiledEntryBundleAssetsMock).not.toHaveBeenCalled()
    expect(emitScriptlessComponentJsFallbackIfMissingMock).not.toHaveBeenCalled()
  })

  it('returns early when required config service is missing', async () => {
    await emitCompiledVueEntryAssets({}, {
      ctx: {},
      pluginCtx: {},
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any, '/project/src/pages/index/index.vue', { isPage: true, result: {} } as any)

    expect(addBundleWatchFileMock).not.toHaveBeenCalled()
    expect(resolveVueBundleAssetContextMock).not.toHaveBeenCalled()
  })

  it('skips compiled entries when emit state cannot be resolved', async () => {
    const state = {
      ctx: {
        configService: { platform: 'wechat' },
      },
      pluginCtx: {},
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any

    resolveCompiledEntryEmitStateMock.mockResolvedValue(undefined)

    await emitCompiledVueEntryAssets(
      {},
      state,
      '/project/src/pages/index/index.vue',
      { isPage: true, result: {}, source: '<template />' } as any,
    )

    expect(addBundleWatchFileMock).toHaveBeenCalledWith({}, '/project/src/pages/index/index.vue')
    expect(resolveVueBundleAssetContextMock).toHaveBeenCalledWith(state.ctx.configService)
    expect(handleCompiledEntryPageLayoutsMock).not.toHaveBeenCalled()
    expect(emitCompiledEntryBundleAssetsMock).not.toHaveBeenCalled()
  })

  it('dispatches compiled entries through shared resolved entry helper flow', async () => {
    const state = {
      ctx: {
        configService: { platform: 'wechat' },
      },
      pluginCtx: {},
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    } as any

    resolveCompiledEntryEmitStateMock.mockResolvedValue({
      result: { template: '<view />', script: 'Page({})' },
      relativeBase: 'pages/index/index',
    })

    await emitCompiledVueEntryAssets(
      {},
      state,
      '/project/src/pages/index/index.vue',
      { isPage: true, result: {}, source: '<template />' } as any,
    )

    expect(handleCompiledEntryPageLayoutsMock).toHaveBeenCalledTimes(1)
    expect(emitCompiledEntryBundleAssetsMock).toHaveBeenCalledTimes(1)
  })
})
