import type { CompilerContext } from '../../../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVueSfcStyleIndependentSignature } from 'wevu/compiler'
import { compileAndFinalizeVueLikeFile, compileVueLikeFile, emitBundleVueEntryAssets, emitCompiledEntryBundleAssets, emitFallbackPageBundleAssets, emitSharedFallbackPageAssets, emitSharedVueEntryAssets, emitSharedVueEntryJsonAsset, finalizeCompiledVueLikeResult, getEntryBaseName, getVueBundlePageLayoutPlan, handleCompiledEntryPageLayouts, handleFallbackPageLayouts, loadFallbackPageEntryCompilation, refreshCompiledVueEntryCacheInDev, resolveClassStyleWxsAsset, resolveCompiledEntryEmitState, resolveFallbackPageEmitState, resolveFallbackPageEntryFile, resolveVueBundleAssetContext } from './shared'

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
const registerResolvedPageLayoutDependenciesMock = vi.hoisted(() => vi.fn(async () => {}))
const resolveVueSfcStyleIndependentSignatureMock = vi.hoisted(() => vi.fn((source: string) => source.replace(/<style[\s\S]*?<\/style>/g, '')))

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

vi.mock('../pageLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pageLayout')>()
  return {
    ...actual,
    resolvePageLayoutPlan: resolvePageLayoutPlanMock,
  }
})

vi.mock('../../../utils/pageLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/pageLayout')>()
  return {
    ...actual,
    registerResolvedPageLayoutDependencies: registerResolvedPageLayoutDependenciesMock,
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
    resolveVueSfcStyleIndependentSignature: resolveVueSfcStyleIndependentSignatureMock,
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
    registerResolvedPageLayoutDependenciesMock.mockReset()
    registerResolvedPageLayoutDependenciesMock.mockResolvedValue(undefined)
    resolveVueSfcStyleIndependentSignatureMock.mockReset()
    resolveVueSfcStyleIndependentSignatureMock.mockImplementation((source: string) => source.replace(/<style[\s\S]*?<\/style>/g, ''))
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

  it('emits page SFC style assets during style-only HMR refresh', async () => {
    await emitCompiledEntryBundleAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              lastHmrEntryIds: new Set(['/project/src/pages/hmr-sfc/index.vue']),
              profile: {
                dirtyReasonSummary: ['entry-style-only:1'],
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

  it('does not emit page SFC style assets during template-only HMR refresh', async () => {
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
        template: '<view class="next" />',
        style: '.marker { color: red; }',
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
    expect(processCssWithCacheMock).not.toHaveBeenCalled()
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
          buildScope: {
            include: ['subs'],
          },
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
        finalizeConfig: expect.any(Function),
        kind: 'app',
        extension: 'json',
      },
    )
    const finalizeConfig = emitSfcJsonAssetMock.mock.calls[0][4].finalizeConfig
    expect(finalizeConfig({
      pages: [
        'pages/issue-793/index',
        'pages/issue-793-settings/index',
      ],
      preloadRule: {
        'pages/issue-793/index': {
          packages: ['subs', 'missing'],
        },
      },
      subPackages: [
        {
          root: 'subs',
          pages: ['issue-793/index'],
        },
        {
          root: 'excluded',
          pages: ['index'],
        },
      ],
      tabBar: {
        list: [
          { pagePath: 'pages/issue-793/index', text: '首页' },
          { pagePath: 'pages/issue-793-settings/index', text: '设置' },
          { pagePath: 'subs/issue-793/index', text: '分包' },
        ],
      },
    })).toEqual({
      pages: [
        'pages/issue-793/index',
        'pages/issue-793-settings/index',
      ],
      preloadRule: {
        'pages/issue-793/index': {
          packages: ['subs'],
        },
      },
      subPackages: [
        {
          root: 'subs',
          pages: ['issue-793/index'],
        },
      ],
      tabBar: {
        list: [
          { pagePath: 'pages/issue-793/index', text: '首页' },
          { pagePath: 'pages/issue-793-settings/index', text: '设置' },
        ],
      },
    })
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

  it('finalizes compiled page results with page feature injection only', async () => {
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ onReachBottom() {}, data: { ready: true } })',
    })

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
    expect(result.script).toBe('Page({ onReachBottom() {}, data: { ready: true } })')
  })

  it('passes resolved layout, app shell, policy, source file, and platform to Vue compilation', async () => {
    const resolvedLayout = {
      kind: 'native' as const,
      file: '/project/src/layouts/default/index',
      importPath: '/layouts/default/index',
      layoutName: 'default',
      tagName: 'weapp-layout-default',
    }
    resolvePageLayoutPlanMock.mockResolvedValue({
      currentLayout: resolvedLayout,
      dynamicSwitch: false,
      layouts: [resolvedLayout],
      dynamicPropKeys: [],
    })

    const pluginCtx = { emitFile: vi.fn() }
    await compileVueLikeFile({
      source: '<view />',
      filename: '/project/src/pages/index/index.vue',
      ctx: {} as any,
      pluginCtx,
      isPage: true,
      isApp: false,
      configService: {
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        cwd: '/project',
        inlineConfig: {},
        weappViteConfig: {
          wevu: {
            autoSetDataPick: false,
          },
        },
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      appShell: {
        file: '/project/src/__weapp_vite_app_shell',
        importPath: '/__weapp_vite_app_shell',
        tagName: 'weapp-app-shell',
      },
    })

    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(compileVueFileMock).toHaveBeenCalledWith(
      '<view />',
      '/project/src/pages/index/index.vue',
      expect.objectContaining({
        autoSetDataPick: false,
        bindingManifestSourceFile: 'src/pages/index/index.vue',
        appShell: {
          importPath: '/__weapp_vite_app_shell',
          tagName: 'weapp-app-shell',
        },
        pageLayout: {
          currentLayout: {
            importPath: '/layouts/default/index',
            layoutName: 'default',
            tagName: 'weapp-layout-default',
          },
          dynamicSwitch: false,
          layouts: [{
            importPath: '/layouts/default/index',
            layoutName: 'default',
            tagName: 'weapp-layout-default',
          }],
          dynamicPropKeys: [],
        },
        template: expect.objectContaining({
          platform: expect.objectContaining({ name: 'wechat' }),
          scopedSlotsRequireProps: false,
        }),
      }),
    )
    expect(compileJsxFileMock).not.toHaveBeenCalled()
    expect(registerResolvedPageLayoutDependenciesMock).toHaveBeenCalledWith(
      expect.anything(),
      '/project/src/pages/index/index.vue',
      [resolvedLayout],
    )
  })

  it('stores block signatures during the initial dev bundle compilation', async () => {
    const hmr = {
      vueEntryHasTemplate: new Map(),
      vueEntrySfcSignatures: new Map(),
      vueEntryTailwindContentSignatures: new Map(),
      vueEntryTailwindTemplateContentSignatures: new Map(),
      vueEntryTailwindScriptContentSignatures: new Map(),
    }
    const filename = '/project/src/components/card.vue'

    await compileVueLikeFile({
      source: '<template><view /></template><script setup>const count = 1</script>',
      filename,
      ctx: {
        runtimeState: {
          build: {
            hmr,
          },
        },
      } as unknown as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      isPage: false,
      isApp: false,
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
      } as unknown as NonNullable<CompilerContext['configService']>,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(hmr.vueEntrySfcSignatures.get(filename)).toEqual({
      config: expect.any(String),
      script: expect.any(String),
      style: expect.any(String),
      template: expect.any(String),
    })
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
    const resolvedLayout = {
      kind: 'vue' as const,
      file: '/layouts/default/index.vue',
      importPath: '/layouts/default/index',
      layoutName: 'default',
      tagName: 'weapp-layout-default',
    }
    resolvePageLayoutPlanMock.mockResolvedValue({
      currentLayout: resolvedLayout,
      dynamicSwitch: false,
      layouts: [resolvedLayout],
      dynamicPropKeys: [],
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
        cwd: '/project',
        inlineConfig: {},
        weappViteConfig: {},
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })

    expect(compileJsxFileMock).toHaveBeenCalledTimes(1)
    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(compileJsxFileMock).toHaveBeenCalledWith(
      'export default () => <view />',
      '/project/src/pages/index/index.tsx',
      expect.objectContaining({
        bindingManifestSourceFile: 'src/pages/index/index.tsx',
        pageLayout: expect.objectContaining({
          dynamicSwitch: false,
          layouts: [expect.objectContaining({
            importPath: '/layouts/default/index',
          })],
        }),
        template: expect.objectContaining({
          platform: expect.objectContaining({ name: 'wechat' }),
        }),
      }),
    )
    expect(registerResolvedPageLayoutDependenciesMock).toHaveBeenCalledWith(
      expect.anything(),
      '/project/src/pages/index/index.tsx',
      [resolvedLayout],
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

  it('leaves compiled app scripts unchanged', async () => {
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

  it('reuses dirty compiled entries when transformed source is unchanged in dev', async () => {
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
              profile: {
                dirtyReasonSummary: ['entry-style-only:1'],
              },
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

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(cached.refreshToken).toBe(0)
    expect(dirtyVueEntryIds.size).toBe(0)
    expect(result).toBe(cached.result)
    expect((result as any).script).toBe('Page({ cached: true })')
    expect(resolveVueSfcStyleIndependentSignatureMock).not.toHaveBeenCalled()
  })

  it('refreshes dirty compiled entries when source changes in dev', async () => {
    const cached = {
      result: { script: 'Page({ cached: true })' },
      source: '<view />',
      isPage: true,
      refreshToken: 1,
    } as any
    readFileMock.mockResolvedValue('<view>{{ title }}</view>')
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
              profile: {
                dirtyReasonSummary: ['entry-style-only:1'],
              },
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

  it('reuses cached compiled entries for style-only dirty updates in dev', async () => {
    const previousSource = '<template><view /></template><style>.page{color:red}</style>'
    const nextSource = '<template><view /></template><style>.page{color:blue}</style>'
    const cached = {
      result: { script: 'Page({ cached: true })', style: '.page{color:red}' },
      source: previousSource,
      isPage: true,
      refreshToken: 1,
      styleIndependentSignature: resolveVueSfcStyleIndependentSignature(previousSource, '/project/src/pages/index/index.vue'),
    } as any
    readFileMock.mockResolvedValue(nextSource)

    const dirtyVueEntryIds = new Set(['/project/src/pages/index/index.vue'])
    const hmrProfile = {
      dirtyReasonSummary: ['entry-style-only:1'],
    }
    const result = await refreshCompiledVueEntryCacheInDev({
      filename: '/project/src/pages/index/index.vue',
      cached,
      ctx: {
        runtimeState: {
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: hmrProfile,
              vueEntryHasTemplate: new Map(),
              vueEntrySfcSignatures: new Map(),
              vueEntryTailwindContentSignatures: new Map(),
              vueEntryTailwindTemplateContentSignatures: new Map(),
              vueEntryTailwindScriptContentSignatures: new Map(),
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

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(cached.source).toBe(nextSource)
    expect(cached.result.style).toContain('color:blue')
    expect(cached.refreshToken).toBe(0)
    expect(dirtyVueEntryIds.size).toBe(0)
    expect(result).toBe(cached.result)
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
              vueEntryHasTemplate: new Map(),
              vueEntrySfcSignatures: new Map(),
              vueEntryTailwindContentSignatures: new Map(),
              vueEntryTailwindTemplateContentSignatures: new Map(),
              vueEntryTailwindScriptContentSignatures: new Map(),
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

  it('resolves and emits compiled entry page layout assets without mutating compiler output', async () => {
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
    expect(result.template).toBe('<view />')
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
    expect(result.template).toBe('<view />')
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
