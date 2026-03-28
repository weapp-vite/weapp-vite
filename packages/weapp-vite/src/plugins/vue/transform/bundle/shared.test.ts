import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addBundleWatchFile, compileAndFinalizeVueLikeFile, compileVueLikeFile, emitBundleVueEntryAssets, emitCompiledEntryBundleAssets, emitFallbackPageBundleAssets, emitSharedFallbackPageAssets, emitSharedVueEntryAssets, emitSharedVueEntryJsonAsset, finalizeCompiledVueLikeResult, getEntryBaseName, handleCompiledEntryPageLayouts, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, refreshCompiledVueEntryCacheInDev, resolveClassStyleWxsAsset, resolveCompiledEntryEmitState, resolveFallbackPageEmitState, resolveFallbackPageEntryFile, resolveVueBundleAssetContext } from './shared'

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
const compileJsxFileMock = vi.hoisted(() => vi.fn(async () => ({
  template: '<view />',
  script: 'Page({})',
})))
const resolvePageLayoutPlanMock = vi.hoisted(() => vi.fn(async () => undefined))
const applyPageLayoutPlanMock = vi.hoisted(() => vi.fn((result: any) => result))
const addResolvedPageLayoutWatchFilesMock = vi.hoisted(() => vi.fn(async () => {}))

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
    applyPageLayoutPlan: applyPageLayoutPlanMock,
    resolvePageLayoutPlan: resolvePageLayoutPlanMock,
  }
})

vi.mock('../../../utils/pageLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/pageLayout')>()
  return {
    ...actual,
    addResolvedPageLayoutWatchFiles: addResolvedPageLayoutWatchFilesMock,
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
    compileJsxFile: compileJsxFileMock,
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
    compileJsxFileMock.mockReset()
    compileJsxFileMock.mockResolvedValue({
      template: '<view />',
      script: 'Page({})',
    })
    resolvePageLayoutPlanMock.mockReset()
    resolvePageLayoutPlanMock.mockResolvedValue(undefined)
    applyPageLayoutPlanMock.mockReset()
    applyPageLayoutPlanMock.mockImplementation((result: any) => result)
    addResolvedPageLayoutWatchFilesMock.mockReset()
    addResolvedPageLayoutWatchFilesMock.mockResolvedValue(undefined)
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

  it('returns undefined for class style wxs assets when runtime module is not needed', () => {
    expect(resolveClassStyleWxsAsset(
      {} as any,
      'pages/index/index',
      '',
      {} as any,
      {
        classStyleWxs: false,
        scopedSlotComponents: [],
      } as any,
    )).toBeUndefined()
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

  it('keeps entry base names unchanged when filenames have no extension', () => {
    expect(getEntryBaseName('/project/src/pages/index/index')).toBe('/project/src/pages/index/index')
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

  it('emits compiled component entry assets with default component json config', () => {
    const result = emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {} as any,
      filename: '/project/src/components/demo-card/index.vue',
      relativeBase: 'components/demo-card/index',
      result: {
        template: '<view />',
        scopedSlotComponents: [],
      } as any,
      isPage: false,
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
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'components/demo-card/index',
      { config: '{"component":true}' },
      {
        defaultConfig: { component: true },
        mergeExistingAsset: false,
        mergeStrategy: 'override',
        defaults: { styleIsolation: 'apply-shared' },
        kind: 'component',
        extension: 'json',
      },
    )
    expect(result).toEqual({
      isAppVue: false,
      shouldEmitComponentJson: true,
    })
  })

  it('emits compiled app entry assets with merged app json config', () => {
    const result = emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {} as any,
      filename: '/project/src/app.vue',
      relativeBase: 'app',
      result: {
        template: '<view />',
        config: '{"window":{"navigationBarTitleText":"首页"}}',
        scopedSlotComponents: [],
      } as any,
      isPage: false,
      configService: {
        weappViteConfig: {
          json: {
            defaults: {
              app: {
                lazyCodeLoading: 'requiredComponents',
              },
            },
            mergeStrategy: 'override',
          },
        },
      } as any,
      templateExtension: 'axml',
      jsonExtension: 'json',
      scriptModuleExtension: 'sjs',
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
    })

    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'app',
      { config: '{"component":true}' },
      {
        defaultConfig: undefined,
        mergeExistingAsset: true,
        mergeStrategy: 'override',
        defaults: { lazyCodeLoading: 'requiredComponents' },
        kind: 'app',
        extension: 'json',
      },
    )
    expect(result).toEqual({
      isAppVue: true,
      shouldEmitComponentJson: false,
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

  it('compiles vue page entries and applies resolved layout plans', async () => {
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [{ kind: 'native', file: '/layouts/default/index' }],
    })

    const pluginCtx = { emitFile: vi.fn() }
    const result = await compileVueLikeFile({
      source: '<view />',
      filename: '/project/src/pages/index/index.vue',
      ctx: {} as any,
      pluginCtx,
      isPage: true,
      isApp: false,
      configService: {
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(compileJsxFileMock).not.toHaveBeenCalled()
    expect(applyPageLayoutPlanMock).toHaveBeenCalledWith(
      result,
      '/project/src/pages/index/index.vue',
      {
        layouts: [{ kind: 'native', file: '/layouts/default/index' }],
      },
    )
    expect(addResolvedPageLayoutWatchFilesMock).toHaveBeenCalledWith(
      pluginCtx,
      [{ kind: 'native', file: '/layouts/default/index' }],
    )
  })

  it('compiles jsx-like page entries through shared jsx branch', async () => {
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [{ kind: 'vue', file: '/layouts/default/index.vue' }],
    })

    const pluginCtx = { emitFile: vi.fn() }
    await compileVueLikeFile({
      source: 'export default () => <view />',
      filename: '/project/src/pages/index/index.tsx',
      ctx: {} as any,
      pluginCtx,
      isPage: true,
      isApp: false,
      configService: {
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileJsxFileMock).toHaveBeenCalledTimes(1)
    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(addResolvedPageLayoutWatchFilesMock).toHaveBeenCalledWith(
      pluginCtx,
      [{ kind: 'vue', file: '/layouts/default/index.vue' }],
    )
  })

  it('compiles and finalizes vue-like entries through shared pipeline', async () => {
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ fromPipeline: true })',
    })

    const result = await compileAndFinalizeVueLikeFile({
      source: '<view />',
      filename: '/project/src/pages/index/index.vue',
      ctx: {} as any,
      pluginCtx: { emitFile: vi.fn() },
      isPage: true,
      isApp: false,
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
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(result.script).toBe('Page({ fromPipeline: true })')
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

  it('resolves compiled entry emit state from refreshed result and output path', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
    } as any

    const result = await resolveCompiledEntryEmitState({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {
        autoImportService: {
          resolve: () => undefined,
        },
      } as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: false,
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(result).toEqual({
      result: { script: 'Page({ cached: true })' },
      relativeBase: 'pages/index/index',
    })
  })

  it('returns undefined for compiled entry emit state when output path cannot be resolved', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
    } as any

    await expect(resolveCompiledEntryEmitState({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {} as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: false,
        relativeOutputPath: () => '',
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })).resolves.toBeUndefined()
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

  it('falls back to cached compiled result when dev refresh recompilation fails', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
    } as any
    readFileMock.mockResolvedValue('<view updated />')
    compileVueFileMock.mockRejectedValue(new Error('compile failed'))

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

    expect(result).toBe(cached.result)
    expect(cached.source).toBe('<view />')
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

  it('resolves fallback page emit state only when output path and source entry both exist', async () => {
    const pathExists = vi.fn(async (candidate: string) => candidate)
    const configService = {
      relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
    } as any

    await expect(resolveFallbackPageEmitState({
      entryId: '/project/src/pages/demo/index',
      configService,
      compilationCache: new Map(),
      pathExists,
    })).resolves.toEqual({
      relativeBase: 'pages/demo/index',
      entryFilePath: '/project/src/pages/demo/index.vue',
    })

    await expect(resolveFallbackPageEmitState({
      entryId: '/project/src/pages/demo/missing',
      configService: {
        relativeOutputPath: () => '',
      } as any,
      compilationCache: new Map(),
      pathExists,
    })).resolves.toBeUndefined()

    await expect(resolveFallbackPageEmitState({
      entryId: '/project/src/pages/demo/index',
      configService,
      compilationCache: new Map([
        ['/project/src/pages/demo/index.vue', { result: {}, isPage: true } as any],
      ]),
      pathExists,
    })).resolves.toBeUndefined()
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

  it('handles compiled entry page layouts through shared resolve-apply-and-emit flow', async () => {
    const emitLayouts = vi.fn(async () => {})
    const result = {
      template: '<view />',
    } as any
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [
        { kind: 'native', file: '/layouts/default/index' },
      ],
    })

    await handleCompiledEntryPageLayouts({
      source: '<view />',
      filename: '/project/src/pages/demo/index.vue',
      result,
      configService: {} as any,
      emitLayouts,
    })

    expect(resolvePageLayoutPlanMock).toHaveBeenCalledWith(
      '<view />',
      '/project/src/pages/demo/index.vue',
      expect.anything(),
    )
    expect(applyPageLayoutPlanMock).toHaveBeenCalledWith(
      result,
      '/project/src/pages/demo/index.vue',
      {
        layouts: [
          { kind: 'native', file: '/layouts/default/index' },
        ],
      },
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
