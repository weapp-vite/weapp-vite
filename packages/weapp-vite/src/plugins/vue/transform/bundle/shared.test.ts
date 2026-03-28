import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addBundleWatchFile, emitBundleVueEntryAssets, emitFallbackPageBundleAssets, emitSharedFallbackPageAssets, emitSharedVueEntryAssets, emitSharedVueEntryJsonAsset, finalizeCompiledVueLikeResult, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, refreshCompiledVueEntryCacheInDev, resolveFallbackPageEntryFile, resolveVueBundleAssetContext } from './shared'

const emitPlatformTemplateAssetMock = vi.hoisted(() => vi.fn())
const emitClassStyleWxsAssetIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const emitSfcStyleIfMissingMock = vi.hoisted(() => vi.fn())
const emitScopedSlotAssetsMock = vi.hoisted(() => vi.fn())
const resolveClassStyleWxsLocationForBaseMock = vi.hoisted(() => vi.fn(() => ({
  fileName: 'pages/index/__class_style.sjs',
})))
const getClassStyleWxsSourceMock = vi.hoisted(() => vi.fn(() => 'module.exports = {}'))
const preparePlatformConfigAssetMock = vi.hoisted(() => vi.fn(() => '{"component":true}'))
const injectWevuPageFeaturesInJsWithViteResolverMock = vi.hoisted(() => vi.fn(async (_ctx: any, code: string) => ({
  transformed: false,
  code,
})))
const collectSetDataPickKeysFromTemplateMock = vi.hoisted(() => vi.fn(() => ['title']))
const injectSetDataPickInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
})))
const isAutoSetDataPickEnabledMock = vi.hoisted(() => vi.fn(() => false))
const readFileMock = vi.hoisted(() => vi.fn(async () => ''))
const compileVueFileMock = vi.hoisted(() => vi.fn(async () => ({
  template: '<view />',
  script: 'Page({})',
})))
const resolvePageLayoutPlanMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('./platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./platform')>()
  return {
    ...actual,
    emitPlatformTemplateAsset: emitPlatformTemplateAssetMock,
    preparePlatformConfigAsset: preparePlatformConfigAssetMock,
  }
})

vi.mock('../emitAssets', () => ({
  emitClassStyleWxsAssetIfMissing: emitClassStyleWxsAssetIfMissingMock,
  emitSfcJsonAsset: emitSfcJsonAssetMock,
  emitSfcStyleIfMissing: emitSfcStyleIfMissingMock,
}))

vi.mock('../scopedSlot', () => ({
  emitScopedSlotAssets: emitScopedSlotAssetsMock,
}))

vi.mock('../injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: injectWevuPageFeaturesInJsWithViteResolverMock,
}))

vi.mock('../injectSetDataPick', () => ({
  collectSetDataPickKeysFromTemplate: collectSetDataPickKeysFromTemplateMock,
  injectSetDataPickInJs: injectSetDataPickInJsMock,
  isAutoSetDataPickEnabled: isAutoSetDataPickEnabledMock,
}))

vi.mock('../pageLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pageLayout')>()
  return {
    ...actual,
    resolvePageLayoutPlan: resolvePageLayoutPlanMock,
  }
})

vi.mock('../classStyle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../classStyle')>()
  return {
    ...actual,
    resolveClassStyleWxsLocationForBase: resolveClassStyleWxsLocationForBaseMock,
  }
})

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return {
    ...actual,
    compileVueFile: compileVueFileMock,
    getClassStyleWxsSource: getClassStyleWxsSourceMock,
  }
})

vi.mock('fs-extra', () => ({
  default: {
    readFile: readFileMock,
  },
}))

describe('emitSharedVueEntryAssets', () => {
  beforeEach(() => {
    emitPlatformTemplateAssetMock.mockReset()
    emitClassStyleWxsAssetIfMissingMock.mockReset()
    emitSfcJsonAssetMock.mockReset()
    emitSfcStyleIfMissingMock.mockReset()
    emitScopedSlotAssetsMock.mockReset()
    resolveClassStyleWxsLocationForBaseMock.mockClear()
    getClassStyleWxsSourceMock.mockClear()
    preparePlatformConfigAssetMock.mockReset()
    preparePlatformConfigAssetMock.mockReturnValue('{"component":true}')
    injectWevuPageFeaturesInJsWithViteResolverMock.mockReset()
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: false,
      code: 'Component({})',
    })
    collectSetDataPickKeysFromTemplateMock.mockReset()
    collectSetDataPickKeysFromTemplateMock.mockReturnValue(['title'])
    injectSetDataPickInJsMock.mockReset()
    injectSetDataPickInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
    }))
    isAutoSetDataPickEnabledMock.mockReset()
    isAutoSetDataPickEnabledMock.mockReturnValue(false)
    readFileMock.mockReset()
    readFileMock.mockResolvedValue('')
    compileVueFileMock.mockReset()
    compileVueFileMock.mockResolvedValue({
      template: '<view />',
      script: 'Page({})',
    })
    resolvePageLayoutPlanMock.mockReset()
    resolvePageLayoutPlanMock.mockResolvedValue(undefined)
  })

  it('emits template, class style wxs, and scoped slot assets through shared flow', () => {
    const result = emitSharedVueEntryAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {} as any,
      filename: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      result: {
        template: '<view />',
        classStyleWxs: true,
        scopedSlotComponents: [],
      } as any,
      configService: { platform: 'alipay' } as any,
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
      scopedSlotDefaults: { component: true },
      scopedSlotMergeStrategy: 'override',
    })

    expect(emitPlatformTemplateAssetMock).toHaveBeenCalledTimes(1)
    expect(emitClassStyleWxsAssetIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/__class_style.sjs',
      'module.exports = {}',
    )
    expect(emitScopedSlotAssetsMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      expect.objectContaining({ template: '<view />' }),
      expect.anything(),
      {
        fileName: 'pages/index/__class_style.sjs',
        source: 'module.exports = {}',
      },
      {},
      {
        defaults: { component: true },
        mergeStrategy: 'override',
      },
    )
    expect(result).toEqual({
      classStyleWxs: {
        fileName: 'pages/index/__class_style.sjs',
        source: 'module.exports = {}',
      },
    })
  })

  it('resolves shared bundle asset context from config service', () => {
    expect(resolveVueBundleAssetContext({
      platform: 'alipay',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'mjs',
        wxs: 'sjs',
      },
      packageJson: {
        dependencies: {
          dayjs: '^1.11.0',
        },
      },
      weappViteConfig: {
        npm: {
          alipayNpmMode: 'node_modules',
        },
      },
    } as any)).toEqual({
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'mjs',
        wxs: 'sjs',
      },
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptExtension: 'mjs',
      scriptModuleExtension: 'sjs',
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
        dependencies: {
          dayjs: '^1.11.0',
        },
        alipayNpmMode: 'node_modules',
      },
    })
  })

  it('emits bundle vue entry assets with shared component json defaults', () => {
    const result = emitBundleVueEntryAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {} as any,
      filename: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      result: {
        template: '<view />',
        scopedSlotComponents: [],
      } as any,
      configService: {
        weappViteConfig: {
          json: {
            defaults: {
              component: {
                styleIsolation: 'apply-shared',
              },
            },
            mergeStrategy: 'override',
          },
        },
      } as any,
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
    })

    expect(emitScopedSlotAssetsMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      expect.objectContaining({ template: '<view />' }),
      expect.anything(),
      undefined,
      {},
      {
        defaults: {
          styleIsolation: 'apply-shared',
        },
        mergeStrategy: 'override',
      },
    )
    expect(result).toEqual({
      jsonConfig: {
        defaults: {
          component: {
            styleIsolation: 'apply-shared',
          },
        },
        mergeStrategy: 'override',
      },
    })
  })

  it('finalizes compiled page results with page feature and setDataPick injections', async () => {
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ data: { ready: true } })',
    })
    injectSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ data: { ready: true }, __setDataPick: ["title"] })',
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(true)

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<view>{{title}}</view>',
        script: 'Page({})',
      } as any,
      filename: '/project/src/pages/index/index.vue',
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<view>{{title}}</view>')
    expect(injectSetDataPickInJsMock).toHaveBeenCalledWith('Page({ data: { ready: true } })', ['title'])
    expect(result.script).toBe('Page({ data: { ready: true }, __setDataPick: ["title"] })')
  })

  it('skips setDataPick injection for app entries', async () => {
    isAutoSetDataPickEnabledMock.mockReturnValue(true)

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<view>{{title}}</view>',
        script: 'App({})',
      } as any,
      filename: '/project/src/app.vue',
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: true,
    })

    expect(injectWevuPageFeaturesInJsWithViteResolverMock).not.toHaveBeenCalled()
    expect(collectSetDataPickKeysFromTemplateMock).not.toHaveBeenCalled()
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(result.script).toBe('App({})')
  })

  it('returns cached compiled result when dev refresh is disabled', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
    } as any

    const result = await refreshCompiledVueEntryCacheInDev({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {} as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: false,
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(readFileMock).not.toHaveBeenCalled()
    expect(result).toBe(cached.result)
  })

  it('returns cached compiled result when source is unchanged in dev', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
    } as any
    readFileMock.mockResolvedValue('<view />')

    const result = await refreshCompiledVueEntryCacheInDev({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {
        autoImportService: {
          resolve: () => undefined,
        },
      } as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {},
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(result).toBe(cached.result)
  })

  it('refreshes compiled cache when source changes in dev', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
    } as any
    readFileMock.mockResolvedValue('<view updated />')
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ refreshed: true })',
    })

    const result = await refreshCompiledVueEntryCacheInDev({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {
        autoImportService: {
          resolve: () => undefined,
        },
      } as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {},
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(cached.source).toBe('<view updated />')
    expect(cached.result).toBe(result)
    expect((result as any).script).toBe('Page({ refreshed: true })')
  })

  it('resolves fallback page entry file with compilation-cache short circuit', async () => {
    const pathExists = vi.fn(async (candidate: string) => candidate)
    const compilationCache = new Map([
      ['/project/src/pages/demo/index.vue', { result: {}, isPage: true } as any],
    ])

    expect(await resolveFallbackPageEntryFile({
      entryId: '/project/src/pages/demo/index',
      compilationCache,
      pathExists,
    })).toBeNull()

    compilationCache.clear()

    expect(await resolveFallbackPageEntryFile({
      entryId: '/project/src/pages/demo/index',
      compilationCache,
      pathExists,
    })).toBe('/project/src/pages/demo/index.vue')
  })

  it('adds normalized watch file through bundle helper', () => {
    const addWatchFile = vi.fn()

    addBundleWatchFile({
      addWatchFile,
    }, 'C:\\project\\src\\pages\\demo\\index.vue')

    expect(addWatchFile).toHaveBeenCalledWith('C:/project/src/pages/demo/index.vue')
  })

  it('skips bundle watch registration when plugin context cannot watch files', () => {
    expect(() => {
      addBundleWatchFile({}, '/project/src/pages/demo/index.vue')
    }).not.toThrow()
  })

  it('loads fallback page entry compilation through shared read-and-compile flow', async () => {
    readFileMock.mockResolvedValue('<view>{{title}}</view>')
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ loaded: true })',
    })

    const result = await loadFallbackPageEntryCompilation({
      entryFilePath: '/project/src/pages/demo/index.vue',
      ctx: {
        autoImportService: {
          resolve: () => undefined,
        },
      } as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {},
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(readFileMock).toHaveBeenCalledWith('/project/src/pages/demo/index.vue', 'utf-8')
    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('<view>{{title}}</view>')
    expect(result.result.script).toBe('Page({ loaded: true })')
  })

  it('emits fallback page bundle assets through shared entry and page flows', () => {
    emitFallbackPageBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {} as any,
      filename: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      result: {
        template: '<view />',
        style: '.page{}',
        config: '{"navigationBarTitleText":"首页"}',
        scopedSlotComponents: [],
      } as any,
      configService: {
        weappViteConfig: {
          json: {
            defaults: {
              component: {
                styleIsolation: 'apply-shared',
              },
              page: {
                navigationStyle: 'default',
              },
            },
            mergeStrategy: 'override',
          },
        },
      } as any,
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptModuleExtension: 'sjs',
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
    })

    expect(emitPlatformTemplateAssetMock).toHaveBeenCalledTimes(1)
    expect(emitScopedSlotAssetsMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      expect.objectContaining({ template: '<view />' }),
      expect.anything(),
      undefined,
      {},
      {
        defaults: {
          styleIsolation: 'apply-shared',
        },
        mergeStrategy: 'override',
      },
    )
    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      '.page{}',
      'acss',
    )
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      { config: '{"component":true}' },
      {
        mergeExistingAsset: true,
        mergeStrategy: 'override',
        defaults: { navigationStyle: 'default' },
        kind: 'page',
        extension: 'json',
      },
    )
  })

  it('handles fallback page layouts through shared resolve-and-emit flow', async () => {
    const emitLayouts = vi.fn(async () => {})
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [
        { kind: 'native', file: '/layouts/default/index' },
      ],
    })

    await handleFallbackPageLayouts({
      source: '<view />',
      entryFilePath: '/project/src/pages/demo/index.vue',
      configService: {} as any,
      emitLayouts,
    })

    expect(resolvePageLayoutPlanMock).toHaveBeenCalledWith(
      '<view />',
      '/project/src/pages/demo/index.vue',
      expect.anything(),
    )
    expect(emitLayouts).toHaveBeenCalledWith([
      { kind: 'native', file: '/layouts/default/index' },
    ])
  })

  it('normalizes config before emitting shared json asset', () => {
    emitSharedVueEntryJsonAsset({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/index/index',
      config: '{"component":true}',
      outputExtensions: { wxml: 'axml' },
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
      jsonOptions: {
        defaultConfig: { component: true },
        mergeExistingAsset: true,
        defaults: { styleIsolation: 'apply-shared' },
        mergeStrategy: 'override' as any,
        kind: 'page',
        extension: 'json',
      },
    })

    expect(preparePlatformConfigAssetMock).toHaveBeenCalledTimes(1)
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      { config: '{"component":true}' },
      {
        defaultConfig: { component: true },
        mergeExistingAsset: true,
        defaults: { styleIsolation: 'apply-shared' },
        mergeStrategy: 'override',
        kind: 'page',
        extension: 'json',
      },
    )
  })

  it('emits fallback page style and shared page json asset', () => {
    emitSharedFallbackPageAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/index/index',
      result: {
        style: '.page{}',
        config: '{"navigationBarTitleText":"首页"}',
      },
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
      styleExtension: 'acss',
      jsonExtension: 'json',
      jsonDefaults: { navigationStyle: 'default' },
      jsonMergeStrategy: 'override' as any,
    })

    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      '.page{}',
      'acss',
    )
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      { config: '{"component":true}' },
      {
        mergeExistingAsset: true,
        mergeStrategy: 'override',
        defaults: { navigationStyle: 'default' },
        kind: 'page',
        extension: 'json',
      },
    )
  })
})
