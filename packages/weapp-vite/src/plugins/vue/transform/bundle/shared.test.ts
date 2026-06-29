import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addBundleWatchFile, compileAndFinalizeVueLikeFile, compileVueLikeFile, emitBundleVueEntryAssets, emitCompiledEntryBundleAssets, emitFallbackPageBundleAssets, emitSharedFallbackPageAssets, emitSharedVueEntryAssets, emitSharedVueEntryJsonAsset, finalizeCompiledVueLikeResult, getEntryBaseName, getVueBundlePageLayoutPlan, handleCompiledEntryPageLayouts, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, refreshCompiledVueEntryCacheInDev, resolveClassStyleWxsAsset, resolveCompiledEntryEmitState, resolveFallbackPageEmitState, resolveFallbackPageEntryFile, resolveVueBundleAssetContext } from './shared'

const emitPlatformTemplateAssetMock = vi.hoisted(() => vi.fn())
const emitClassStyleWxsAssetIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const emitSfcStyleIfMissingMock = vi.hoisted(() => vi.fn())
const emitScopedSlotAssetsMock = vi.hoisted(() => vi.fn())
const processCssWithCacheMock = vi.hoisted(() => vi.fn(async (code: string) => code))
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
const injectScopedSlotOwnerSetDataPickInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
})))
const injectScopedSlotHostPropertiesInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
})))
const mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock = vi.hoisted(() => vi.fn(() => false))
const isAutoSetDataPickEnabledMock = vi.hoisted(() => vi.fn(() => false))
const mayNeedInjectSetDataPickInJsMock = vi.hoisted(() => vi.fn(() => true))
const pruneScopedSlotOwnerAutoSetDataPickKeysMock = vi.hoisted(() => vi.fn((keys: string[]) => keys.filter(key => !key.startsWith('__wv_bind_'))))
const shouldUseScopedSlotOwnerOnlySetDataPickMock = vi.hoisted(() => vi.fn(() => false))
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

vi.mock('../../../css/shared/preprocessor', () => ({
  processCssWithCache: processCssWithCacheMock,
}))

vi.mock('../scopedSlot', () => ({
  emitScopedSlotAssets: emitScopedSlotAssetsMock,
}))

vi.mock('../injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: injectWevuPageFeaturesInJsWithViteResolverMock,
}))

vi.mock('../injectSetDataPick', () => ({
  collectSetDataPickKeysFromTemplate: collectSetDataPickKeysFromTemplateMock,
  injectScopedSlotHostPropertiesInJs: injectScopedSlotHostPropertiesInJsMock,
  injectScopedSlotOwnerSetDataPickInJs: injectScopedSlotOwnerSetDataPickInJsMock,
  injectSetDataPickInJs: injectSetDataPickInJsMock,
  isAutoSetDataPickEnabled: isAutoSetDataPickEnabledMock,
  mayNeedInjectSetDataPickInJs: mayNeedInjectSetDataPickInJsMock,
  mayNeedScopedSlotHostPropertiesForSetupSlotsInJs: mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock,
  pruneScopedSlotOwnerAutoSetDataPickKeys: pruneScopedSlotOwnerAutoSetDataPickKeysMock,
  shouldUseScopedSlotOwnerOnlySetDataPick: shouldUseScopedSlotOwnerOnlySetDataPickMock,
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

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      readFile: readFileMock,
    },
  }
})

describe('emitSharedVueEntryAssets', () => {
  beforeEach(() => {
    emitPlatformTemplateAssetMock.mockReset()
    emitClassStyleWxsAssetIfMissingMock.mockReset()
    emitSfcJsonAssetMock.mockReset()
    emitSfcStyleIfMissingMock.mockReset()
    emitScopedSlotAssetsMock.mockReset()
    processCssWithCacheMock.mockReset()
    processCssWithCacheMock.mockImplementation(async (code: string) => code)
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
    injectScopedSlotOwnerSetDataPickInJsMock.mockReset()
    injectScopedSlotOwnerSetDataPickInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
    }))
    injectScopedSlotHostPropertiesInJsMock.mockReset()
    injectScopedSlotHostPropertiesInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
    }))
    mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock.mockReset()
    mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock.mockReturnValue(false)
    isAutoSetDataPickEnabledMock.mockReset()
    isAutoSetDataPickEnabledMock.mockReturnValue(false)
    mayNeedInjectSetDataPickInJsMock.mockReset()
    mayNeedInjectSetDataPickInJsMock.mockReturnValue(true)
    pruneScopedSlotOwnerAutoSetDataPickKeysMock.mockReset()
    pruneScopedSlotOwnerAutoSetDataPickKeysMock.mockImplementation((keys: string[]) => keys.filter(key => !key.startsWith('__wv_bind_')))
    shouldUseScopedSlotOwnerOnlySetDataPickMock.mockReset()
    shouldUseScopedSlotOwnerOnlySetDataPickMock.mockReturnValue(false)
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

  it('emits compiled component entry assets with default component json config', async () => {
    const result = await emitCompiledEntryBundleAssets({
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

  it('emits page SFC style assets during asset-only HMR refresh', async () => {
    await emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              lastHmrEntryIds: new Set(['/project/src/pages/hmr-sfc/index.vue']),
              profile: {
                dirtyReasonSummary: ['entry-local-asset:1'],
              },
            },
          },
        },
      } as any,
      filename: '/project/src/pages/hmr-sfc/index.vue',
      relativeBase: 'pages/hmr-sfc/index',
      result: {
        template: '<view />',
        style: '.marker { color: red; }',
        scopedSlotComponents: [],
      } as any,
      isPage: true,
      configService: {
        isDev: true,
        platform: 'weapp',
      } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions: {
        wxss: 'wxss',
      },
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/hmr-sfc/index',
      '.marker { color: red; }',
      'wxss',
      undefined,
    )
    expect(processCssWithCacheMock).toHaveBeenCalledWith('.marker { color: red; }', expect.objectContaining({
      isDev: true,
    }))
  })

  it('does not overwrite Vite-processed page SFC style assets during css importer HMR', async () => {
    await emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              lastHmrEntryIds: new Set(['/project/src/pages/hmr-sfc/index.vue']),
              profile: {
                dirtyReasonSummary: ['css-importer:1'],
              },
            },
          },
        },
      } as any,
      filename: '/project/src/pages/hmr-sfc/index.vue',
      relativeBase: 'pages/hmr-sfc/index',
      result: {
        template: '<view />',
        style: '@import "./hello.css";',
        scopedSlotComponents: [],
      } as any,
      isPage: true,
      configService: {
        isDev: true,
      } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions: {
        wxss: 'wxss',
      },
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(emitSfcStyleIfMissingMock).not.toHaveBeenCalled()
  })

  it('emits compiled app entry assets with merged app json config', async () => {
    const result = await emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              profile: {
                file: '/project/src/app.vue',
              },
            },
          },
        },
      } as any,
      filename: '/project/src/app.vue',
      relativeBase: 'app',
      result: {
        template: '<view />',
        config: '{"window":{"navigationBarTitleText":"首页"}}',
        style: '.app { color: red; }',
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
      outputExtensions: {
        wxss: 'acss',
      },
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
    })

    expect(emitPlatformTemplateAssetMock).not.toHaveBeenCalled()
    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'app',
      '.app { color: red; }',
      'acss',
      { updateExisting: false },
    )
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

  it('does not overwrite processed app styles during unrelated dev HMR updates', async () => {
    await emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              profile: {
                file: '/project/src/pages/list/index.vue',
                dirtyReasonSummary: ['entry-direct:1'],
              },
            },
          },
        },
      } as any,
      filename: '/project/src/app.vue',
      relativeBase: 'app',
      result: {
        config: '{"window":{"navigationBarTitleText":"首页"}}',
        style: '@tailwind base;',
        scopedSlotComponents: [],
      } as any,
      isPage: false,
      configService: {
        isDev: true,
      } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptModuleExtension: 'wxs',
      outputExtensions: {
        wxss: 'wxss',
      },
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: 'wxml',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(emitSfcStyleIfMissingMock).not.toHaveBeenCalled()
  })

  it('finalizes compiled page results with page feature and setDataPick injections', async () => {
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ onReachBottom() {}, data: { ready: true } })',
    })
    injectSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ onReachBottom() {}, data: { ready: true }, __setDataPick: ["title"] })',
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(true)

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<view>{{title}}</view>',
        script: 'Page({ onReachBottom() {} })',
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
    expect(injectSetDataPickInJsMock).toHaveBeenCalledWith('Page({ onReachBottom() {}, data: { ready: true } })', ['title'])
    expect(result.script).toBe('Page({ onReachBottom() {}, data: { ready: true }, __setDataPick: ["title"] })')
  })

  it('injects scoped slot owner setDataPick even when auto pick is disabled', async () => {
    injectScopedSlotOwnerSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ __slotOwnerPick: true })',
    })

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />',
        script: 'Page({})',
      } as any,
      filename: '/project/src/pages/index/index.vue',
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        weappViteConfig: {
          wevu: {
            autoSetDataPick: false,
          },
        },
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />')
    expect(pruneScopedSlotOwnerAutoSetDataPickKeysMock).toHaveBeenCalledWith(['title'])
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(injectScopedSlotOwnerSetDataPickInJsMock).toHaveBeenCalledWith('Page({})', ['title'])
    expect(result.script).toBe('Page({ __slotOwnerPick: true })')
  })

  it('uses scoped slot owner setDataPick when auto pick collects too many bind keys', async () => {
    const keys = ['currentStep', ...Array.from({ length: 201 }, (_, index) => `__wv_bind_${index}`), 'formState']
    collectSetDataPickKeysFromTemplateMock.mockReturnValue(keys)
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    shouldUseScopedSlotOwnerOnlySetDataPickMock.mockReturnValue(true)
    injectScopedSlotOwnerSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ __slotOwnerPick: true })',
    })

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />',
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

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />')
    expect(shouldUseScopedSlotOwnerOnlySetDataPickMock).toHaveBeenCalledWith(keys)
    expect(pruneScopedSlotOwnerAutoSetDataPickKeysMock).toHaveBeenCalledWith(keys)
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(injectScopedSlotOwnerSetDataPickInJsMock).toHaveBeenCalledWith('Page({})', ['currentStep', 'formState'])
    expect(result.script).toBe('Page({ __slotOwnerPick: true })')
  })

  it('injects scoped slot owner setDataPick when template has only owner id binding', async () => {
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    collectSetDataPickKeysFromTemplateMock.mockReturnValue([])
    injectScopedSlotOwnerSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ __slotOwnerPick: true })',
    })

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" />',
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

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" />')
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(injectScopedSlotOwnerSetDataPickInJsMock).toHaveBeenCalledWith('Page({})', [])
    expect(result.script).toBe('Page({ __slotOwnerPick: true })')
  })

  it('injects scoped slot host properties when componentGenerics are emitted', async () => {
    injectScopedSlotHostPropertiesInJsMock.mockReturnValue({
      transformed: true,
      code: 'Component({ properties: { __wvSlotOwnerId: String } })',
    })

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<view><scoped-slots-footer /></view>',
        script: 'Component({ setup() { return {} } })',
        componentGenerics: {
          'scoped-slots-footer': true,
        },
      } as any,
      filename: '/project/src/components/NamedSlotCard/index.vue',
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
    })

    expect(injectScopedSlotHostPropertiesInJsMock).toHaveBeenCalledWith('Component({ setup() { return {} } })')
    expect(result.script).toContain('__wvSlotOwnerId')
  })

  it('injects slot presence host properties when native slot fallback uses vueSlots', async () => {
    injectScopedSlotHostPropertiesInJsMock.mockReturnValue({
      transformed: true,
      code: 'Component({ properties: { vueSlots: { type: null, value: null } } })',
    })

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<block wx:if="{{vueSlots&&vueSlots.default}}"><slot /></block>',
        script: 'Component({ setup() { return {} } })',
      } as any,
      filename: '/project/src/components/PlainSlotCard/index.vue',
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
    })

    expect(injectScopedSlotHostPropertiesInJsMock).toHaveBeenCalledWith('Component({ setup() { return {} } })')
    expect(result.script).toContain('vueSlots')
  })

  it('injects slot host properties when setup uses slots without template vueSlots fallback', async () => {
    mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock.mockReturnValue(true)
    injectScopedSlotHostPropertiesInJsMock.mockReturnValue({
      transformed: true,
      code: 'Component({ properties: { vueSlots: { type: null, value: null } } })',
    })

    const result = await finalizeCompiledVueLikeResult({
      result: {
        template: '<view><slot /></view>',
        script: 'import { useSlots } from "wevu/internal-runtime"; Component({ setup() { return { slots: useSlots() } } })',
      } as any,
      filename: '/project/src/components/SlotProbe/index.vue',
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
    })

    expect(mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock).toHaveBeenCalledWith(expect.stringContaining('useSlots'))
    expect(injectScopedSlotHostPropertiesInJsMock).toHaveBeenCalledWith(expect.stringContaining('useSlots'))
    expect(result.script).toContain('vueSlots')
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
    expect(compileVueFileMock).toHaveBeenCalledWith(
      '<view />',
      '/project/src/pages/index/index.vue',
      expect.objectContaining({
        template: expect.objectContaining({
          scopedSlotsRequireProps: false,
        }),
      }),
    )
    expect(compileJsxFileMock).not.toHaveBeenCalled()
    expect(applyPageLayoutPlanMock).toHaveBeenCalledWith(
      result,
      '/project/src/pages/index/index.vue',
      {
        layouts: [{ kind: 'native', file: '/layouts/default/index' }],
      },
      {
        platform: 'weapp',
      },
    )
    expect(addResolvedPageLayoutWatchFilesMock).toHaveBeenCalledWith(
      pluginCtx,
      [{ kind: 'native', file: '/layouts/default/index' }],
    )
  })

  it('preserves native plain slot compilation when scopedSlotsRequireProps is explicit', async () => {
    await compileVueLikeFile({
      source: '<slot-host><template #header><view>Header</view></template></slot-host>',
      filename: '/project/src/pages/index/index.vue',
      ctx: {} as any,
      pluginCtx: { emitFile: vi.fn() },
      isPage: true,
      isApp: false,
      configService: {
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {
          vue: {
            template: {
              scopedSlotsRequireProps: true,
            },
          },
        },
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileVueFileMock).toHaveBeenCalledWith(
      '<slot-host><template #header><view>Header</view></template></slot-host>',
      '/project/src/pages/index/index.vue',
      expect.objectContaining({
        template: expect.objectContaining({
          scopedSlotsRequireProps: true,
        }),
      }),
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

  it('refreshes dirty compiled entries even when source is unchanged in dev', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
      refreshToken: 1,
    } as any
    readFileMock.mockResolvedValue('<view />')
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ refreshed: true })',
    })

    const dirtyVueEntryIds = new Set(['/project/src/pages/index/index.vue'])
    const result = await refreshCompiledVueEntryCacheInDev({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              dirtyVueEntryIds,
            },
          },
        },
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
    expect(cached.refreshToken).toBe(0)
    expect(dirtyVueEntryIds.size).toBe(0)
    expect(result).toBe(cached.result)
    expect((result as any).script).toBe('Page({ refreshed: true })')
  })

  it('refreshes dirty compiled app entries when dirty ids use windows separators', async () => {
    const appSource = [
      '<script setup>',
      'import routes from "weapp-vite/auto-routes"',
      '</script>',
    ].join('\n')
    const cached = {
      result: { script: 'App({ cached: true })' },
      source: appSource,
      autoRoutesSignature: 'current-routes',
      isPage: false,
      refreshToken: 1,
    } as any
    const dirtyVueEntryIds = new Set(['D:\\project\\src\\app.vue'])
    readFileMock.mockResolvedValue(appSource)
    compileVueFileMock.mockResolvedValue({
      template: '<view />',
      script: 'App({ refreshed: true })',
    })

    const result = await refreshCompiledVueEntryCacheInDev({
      filename: 'D:/project/src/app.vue',
      cached,
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              dirtyVueEntryIds,
            },
          },
        },
        autoImportService: {
          resolve: () => undefined,
        },
        autoRoutesService: {
          ensureFresh: vi.fn(async () => {}),
          getReference: () => ({
            pages: [{ path: 'pages/logs/hmr-added' }],
            entries: [],
            subPackages: [],
          }),
          getSignature: () => 'current-routes',
        },
      } as any,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('D:/project/src/', ''),
        weappViteConfig: {},
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(compileVueFileMock).toHaveBeenCalledWith(
      expect.stringContaining('pages/logs/hmr-added'),
      'D:/project/src/app.vue',
      expect.anything(),
    )
    expect(cached.autoRoutesSignature).toBe('current-routes')
    expect(cached.refreshToken).toBe(0)
    expect(dirtyVueEntryIds.size).toBe(0)
    expect((result as any).script).toBe('App({ refreshed: true })')
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
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect((result as any).script).toBe('Page({ refreshed: true })')
  })

  it('treats windows style current app.vue hmr file as the active app update', async () => {
    const result = await emitCompiledEntryBundleAssets({
      bundle: {
        'app.js': {
          type: 'chunk',
          fileName: 'app.js',
          code: 'App({})',
          imports: [],
          dynamicImports: [],
        },
      },
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              profile: {
                file: '\\project\\src\\app.vue',
                dirtyReasonSummary: ['auto-routes-topology:1'],
              },
              lastHmrEntryIds: new Set(['/project/src/app.vue']),
            },
          },
        },
      } as any,
      filename: '/project/src/app.vue',
      relativeBase: 'app',
      result: {
        script: 'App({})',
        template: '<slot />',
        style: '.app { color: red; }',
      } as any,
      isPage: false,
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {},
      } as any,
      templateExtension: '.wxml',
      jsonExtension: '.json',
      outputExtensions: {
        json: '.json',
        template: '.wxml',
        script: '.js',
        style: '.wxss',
        wxss: '.wxss',
      } as any,
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: '.wxml',
      },
    })

    expect(result).toEqual({
      isAppVue: true,
      shouldEmitComponentJson: false,
    })
    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'app',
      '.app { color: red; }',
      '.wxss',
      { updateExisting: false },
    )
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
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(result.result.script).toBe('Page({ loaded: true })')
  })

  it('emits fallback page bundle assets through shared entry and page flows', async () => {
    await emitFallbackPageBundleAssets({
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
      {
        platform: undefined,
      },
    )
    expect(emitLayouts).toHaveBeenCalledWith([
      { kind: 'native', file: '/layouts/default/index' },
    ])
  })

  it('reuses cached compiled entry page layout plan when available', async () => {
    const emitLayouts = vi.fn(async () => {})
    const result = {
      template: '<view />',
      meta: {
        pageLayoutPlan: {
          layouts: [
            { kind: 'native', file: '/layouts/cached/index' },
          ],
        },
      },
    } as any

    await handleCompiledEntryPageLayouts({
      source: '<view />',
      filename: '/project/src/pages/demo/index.vue',
      result,
      configService: {} as any,
      emitLayouts,
    })

    expect(resolvePageLayoutPlanMock).not.toHaveBeenCalled()
    expect(getVueBundlePageLayoutPlan(result)).toEqual({
      layouts: [
        { kind: 'native', file: '/layouts/cached/index' },
      ],
    })
    expect(applyPageLayoutPlanMock).toHaveBeenCalledWith(
      result,
      '/project/src/pages/demo/index.vue',
      {
        layouts: [
          { kind: 'native', file: '/layouts/cached/index' },
        ],
      },
      {
        platform: undefined,
      },
    )
    expect(emitLayouts).toHaveBeenCalledWith([
      { kind: 'native', file: '/layouts/cached/index' },
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

  it('emits fallback page style and shared page json asset', async () => {
    await emitSharedFallbackPageAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        platform: 'alipay',
      } as any,
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

  it('post-processes fallback page style before emitting', async () => {
    processCssWithCacheMock.mockResolvedValueOnce('@import \'./keep.css\';\n.page{}')

    await emitSharedFallbackPageAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        platform: 'weapp',
      } as any,
      relativeBase: 'pages/index/index',
      result: {
        style: '@wv-keep-import \'./keep.css\';\n.page{}',
      },
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: 'wxml',
      },
      styleExtension: 'wxss',
      jsonExtension: 'json',
    })

    expect(processCssWithCacheMock).toHaveBeenCalledWith(
      '@wv-keep-import \'./keep.css\';\n.page{}',
      expect.objectContaining({ platform: 'weapp' }),
    )
    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      '@import \'./keep.css\';\n.page{}',
      'wxss',
    )
  })
})
