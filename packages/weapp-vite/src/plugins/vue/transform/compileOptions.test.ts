import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCompileVueFileOptions, resolveVueTemplatePlatformOptions } from './compileOptions'

const loggerWarnMock = vi.hoisted(() => vi.fn())
const createSfcResolveSrcOptionsMock = vi.hoisted(() => vi.fn((pluginCtx: any) => ({
  resolveId: async (source: string, importer?: string) => {
    if (typeof pluginCtx?.resolve !== 'function') {
      return undefined
    }
    const resolved = await pluginCtx.resolve(source, importer)
    return resolved?.id
  },
  checkMtime: true,
})))
const resolveClassStyleWxsLocationForBaseMock = vi.hoisted(() => vi.fn(() => ({
  src: '/virtual/__class_style__.wxs',
})))
const createUsingComponentPathResolverMock = vi.hoisted(() => vi.fn(() => 'resolved/path'))
const resolveEntryPathMock = vi.hoisted(() => vi.fn(async () => undefined as string | undefined))
const resolveWevuDefaultsWithPresetMock = vi.hoisted(() => vi.fn(() => ({
  preset: 'default',
})))
const isWevuMinifyEnabledMock = vi.hoisted(() => vi.fn((_config: any, isDev = false) => !isDev))

vi.mock('../../../logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

vi.mock('../../utils/vueSfc', () => ({
  createSfcResolveSrcOptions: createSfcResolveSrcOptionsMock,
}))

vi.mock('./classStyle', () => ({
  resolveClassStyleWxsLocationForBase: resolveClassStyleWxsLocationForBaseMock,
}))

vi.mock('../../../utils/entryResolve', () => ({
  createCachedEntryResolveOptions: vi.fn((_configService: any, options?: any) => ({
    kind: options?.kind,
  })),
  resolveEntryPath: resolveEntryPathMock,
}))

vi.mock('./usingComponentResolver', () => ({
  createUsingComponentPathResolver: createUsingComponentPathResolverMock,
}))

vi.mock('./wevuPreset', () => ({
  resolveWevuDefaultsWithPreset: resolveWevuDefaultsWithPresetMock,
  isWevuMinifyEnabled: isWevuMinifyEnabledMock,
}))

describe('resolveVueTemplatePlatformOptions', () => {
  beforeEach(() => {
    isWevuMinifyEnabledMock.mockClear()
    resolveEntryPathMock.mockReset()
    resolveEntryPathMock.mockResolvedValue(undefined)
  })

  it('resolves template platform and wxs runtime support', () => {
    const weappOptions = resolveVueTemplatePlatformOptions({
      platform: 'weapp',
      wxsEnabled: true,
      wxsExtension: 'wxs',
      classStyleRuntime: 'auto',
      classStyleRuntimeWarned: { value: false },
    })
    expect(weappOptions.templatePlatform.name).toBe('wechat')
    expect(weappOptions.supportsWxs).toBe(true)
    expect(weappOptions.wxsExtension).toBe('wxs')
    expect(weappOptions.classStyleRuntime).toBe('wxs')

    const alipayOptions = resolveVueTemplatePlatformOptions({
      platform: 'alipay',
      wxsEnabled: true,
      wxsExtension: 'sjs',
      classStyleRuntime: 'auto',
      classStyleRuntimeWarned: { value: false },
    })
    expect(alipayOptions.templatePlatform.name).toBe('alipay')
    expect(alipayOptions.supportsWxs).toBe(true)
    expect(alipayOptions.wxsExtension).toBe('sjs')
    expect(alipayOptions.classStyleRuntime).toBe('wxs')
  })

  it('falls back to js runtime when wxs is disabled or unavailable', () => {
    const warned = { value: false }

    const disabledOptions = resolveVueTemplatePlatformOptions({
      platform: 'weapp',
      wxsEnabled: false,
      wxsExtension: 'wxs',
      classStyleRuntime: 'auto',
      classStyleRuntimeWarned: { value: false },
    })
    expect(disabledOptions.templatePlatform.name).toBe('wechat')
    expect(disabledOptions.supportsWxs).toBe(false)
    expect(disabledOptions.wxsExtension).toBeUndefined()
    expect(disabledOptions.classStyleRuntime).toBe('js')

    const fallbackOptions = resolveVueTemplatePlatformOptions({
      platform: 'weapp',
      wxsEnabled: true,
      wxsExtension: undefined,
      classStyleRuntime: 'wxs',
      classStyleRuntimeWarned: warned,
    })
    expect(fallbackOptions.templatePlatform.name).toBe('wechat')
    expect(fallbackOptions.supportsWxs).toBe(false)
    expect(fallbackOptions.wxsExtension).toBeUndefined()
    expect(fallbackOptions.classStyleRuntime).toBe('js')
    expect(warned.value).toBe(true)
  })

  it('creates compile options with resolved platform helpers', async () => {
    const autoImportResolve = vi.fn(() => ({ value: { name: 'FooCard', from: '/components/foo-card' } }))
    const pluginResolve = vi.fn(async () => ({ id: '/resolved/source.vue' }))
    const options = createCompileVueFileOptions(
      {
        autoImportService: {
          resolve: autoImportResolve,
        },
      } as any,
      {
        resolve: pluginResolve,
      },
      '/project/src/pages/home/index.vue',
      true,
      false,
      {
        platform: 'alipay',
        isDev: true,
        outputExtensions: {
          wxs: 'sjs',
        },
        weappViteConfig: {
          wxs: true,
          json: {
            defaults: {
              page: { navigationBarTitleText: 'demo' },
            },
            mergeStrategy: 'merge',
          },
          vue: {
            template: {
              htmlTagToWxml: {
                div: 'view',
              },
              htmlTagToWxmlTagClass: false,
              scopedSlotsCompiler: 'augmented',
              slotSingleRootNoWrapper: true,
              slotFallbackWrapper: {
                tag: 'cover-view',
                attrs: {
                  class: 'slot-wrapper',
                },
                rules: [
                  {
                    component: 'IssueCard',
                    slot: 'header',
                    tag: 'custom-header',
                    attrs: {
                      class: 'slot-header',
                    },
                  },
                ],
              },
              classStyleRuntime: 'auto',
              functionPropNames: ['handler', /^on[A-Z]/],
            },
          },
        },
        relativeOutputPath: () => 'pages/home/index',
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.template.platform.name).toBe('alipay')
    expect(options.template.htmlTagToWxml).toEqual({
      div: 'view',
    })
    expect(options.template.htmlTagToWxmlTagClass).toBe(false)
    expect(options.template.classStyleRuntime).toBe('wxs')
    expect(options.template.functionPropNames).toEqual(['handler', /^on[A-Z]/])
    expect(options.template.wxsExtension).toBe('sjs')
    expect(options.template.classStyleWxsSrc).toBe('/virtual/__class_style__.wxs')
    expect(options.template.scopedSlotsRequireProps).toBe(false)
    expect(options.template.slotFallbackWrapperStrategy).toBe('view')
    expect(options.template.slotSingleRootNoWrapper).toBe(true)
    expect(options.template.slotFallbackWrapper).toEqual({
      tag: 'cover-view',
      attrs: {
        class: 'slot-wrapper',
      },
      rules: [
        {
          component: 'IssueCard',
          slot: 'header',
          tag: 'custom-header',
          attrs: {
            class: 'slot-header',
          },
        },
      ],
    })
    expect(options.json).toEqual({
      kind: 'page',
      defaults: {
        page: { navigationBarTitleText: 'demo' },
      },
      mergeStrategy: 'merge',
    })
    expect(options.minify).toBe(false)
    expect(options.wevuDefaults).toEqual({ preset: 'default' })
    expect(createUsingComponentPathResolverMock).toHaveBeenCalled()
    expect(await options.autoImportTags.resolveUsingComponent('FooCard')).toEqual({
      name: 'FooCard',
      from: '/components/foo-card',
      sourceType: 'native',
    })
    expect(autoImportResolve).toHaveBeenCalledWith('FooCard', '/project/src/pages/home/index')
    expect(await options.sfcSrc.resolveId('./source.vue', '/project/src/pages/home/index.vue')).toBe('/resolved/source.vue')
    expect(pluginResolve).toHaveBeenCalledWith('./source.vue', '/project/src/pages/home/index.vue')
    expect(options.sfcSrc.checkMtime).toBe(true)
  })

  it('falls back when compile options lack wxs support or plugin resolve', async () => {
    const state = { value: false }
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: true,
        outputExtensions: {},
        weappViteConfig: {
          wxs: false,
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: state,
      },
    )

    expect(options.template.classStyleRuntime).toBe('js')
    expect(options.template.wxsExtension).toBeUndefined()
    expect(options.template.classStyleWxsSrc).toBeUndefined()
    expect(options.template.slotSingleRootNoWrapper).toBe(false)
    expect(options.template.slotFallbackWrapperStrategy).toBe('virtual-host')
    expect(options.json.kind).toBe('component')
    expect(await options.autoImportTags.resolveUsingComponent('Missing')).toBeUndefined()
    expect(await options.sfcSrc.resolveId('./source.vue', '/project/src/components/card.vue')).toBeUndefined()
    expect(state.value).toBe(true)
    expect(loggerWarnMock).toHaveBeenCalled()
  })

  it('uses virtual-host slot fallback wrapper by default only on weapp platform', () => {
    const weappOptions = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    const alipayOptions = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'alipay',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(weappOptions.template.slotFallbackWrapperStrategy).toBe('virtual-host')
    expect(alipayOptions.template.slotFallbackWrapperStrategy).toBe('view')
  })

  it('allows slot fallback wrapper strategy to fall back to legacy view output', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              slotFallbackWrapperStrategy: 'view',
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.template.slotFallbackWrapperStrategy).toBe('view')
  })

  it('marks resolver auto-imports that point at local vue sfc files', async () => {
    const autoImportResolve = vi.fn(() => ({
      kind: 'resolver',
      value: {
        name: 'Issue520ResolverSlotCard',
        from: '/components/issue-520/ResolverSlotCard/index.vue',
      },
    }))
    const options = createCompileVueFileOptions(
      {
        autoImportService: {
          resolve: autoImportResolve,
        },
      } as any,
      {} as any,
      '/project/src/pages/issue-520/index.vue',
      true,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        absoluteSrcRoot: '/project/src',
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(await options.autoImportTags.resolveUsingComponent('Issue520ResolverSlotCard')).toEqual({
      name: 'Issue520ResolverSlotCard',
      from: '/components/issue-520/ResolverSlotCard/index.vue',
      sourceType: 'wevu-sfc',
    })
  })

  it('marks resolver auto-imports with extensionless resolvedId when entry resolution finds a vue sfc', async () => {
    const resolvedVueEntry = '/workspace/packages/ui/ResolverCard/index.vue'
    resolveEntryPathMock.mockImplementation(async (value: string) => {
      return value === '/workspace/packages/ui/ResolverCard/index'
        ? resolvedVueEntry
        : undefined
    })
    const autoImportResolve = vi.fn(() => ({
      kind: 'resolver',
      value: {
        name: 'ResolverCard',
        from: '/issue-fixtures/issue-651/ResolverCard/index',
        resolvedId: '/workspace/packages/ui/ResolverCard/index',
      },
    }))
    const options = createCompileVueFileOptions(
      {
        autoImportService: {
          resolve: autoImportResolve,
        },
      } as any,
      {} as any,
      '/project/src/pages/issue-651/index.vue',
      true,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        absoluteSrcRoot: '/project/src',
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    await expect(options.autoImportTags.resolveUsingComponent('ResolverCard')).resolves.toEqual({
      name: 'ResolverCard',
      from: '/issue-fixtures/issue-651/ResolverCard/index',
      resolvedId: resolvedVueEntry,
      sourceType: 'wevu-sfc',
    })
  })

  it('defaults plain slots to augmented scoped slot compilation', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.template.scopedSlotsCompiler).toBe('auto')
    expect(options.template.scopedSlotsRequireProps).toBe(false)
  })

  it('allows preserving native plain slot output with explicit scopedSlotsRequireProps', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: true,
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              scopedSlotsRequireProps: true,
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.template.scopedSlotsRequireProps).toBe(true)
  })

  it('passes explicit scopedSlotsCompiler mode through to template compiler', () => {
    const augmented = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: true,
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              scopedSlotsCompiler: 'augmented',
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(augmented.template.scopedSlotsCompiler).toBe('augmented')
    expect(augmented.template.scopedSlotsRequireProps).toBe(false)
  })

  it('preserves boolean htmlTagToWxml config when resolving compile options', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              htmlTagToWxml: false,
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.template.htmlTagToWxml).toBe(false)
    expect(options.template.htmlTagToWxmlTagClass).toBe(true)
  })

  it('defaults formatWxml to dev mode and allows explicit overrides', () => {
    const devOptions = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        isDev: true,
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )
    expect(devOptions.template.formatWxml).toBe(true)

    const buildOptions = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        isDev: false,
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )
    expect(buildOptions.template.formatWxml).toBe(false)

    const explicitBuildOptions = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        isDev: false,
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              formatWxml: true,
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )
    expect(explicitBuildOptions.template.formatWxml).toBe(true)
  })

  it('allows disabling mapped tag class injection in compile options', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              htmlTagToWxmlTagClass: false,
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.template.htmlTagToWxmlTagClass).toBe(false)
  })

  it('reads component allowNullPropInput from weapp.wevu.defaults', () => {
    resolveWevuDefaultsWithPresetMock.mockReturnValueOnce({
      component: {
        allowNullPropInput: true,
      },
    })

    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {
          wevu: {
            defaults: {
              component: {
                allowNullPropInput: true,
              },
            },
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.wevuDefaults).toEqual({
      component: {
        allowNullPropInput: true,
      },
    })
    expect(resolveWevuDefaultsWithPresetMock).toHaveBeenCalledWith({
      wevu: {
        defaults: {
          component: {
            allowNullPropInput: true,
          },
        },
      },
    })
  })

  it('passes the wevu minify flag from config', () => {
    isWevuMinifyEnabledMock.mockReturnValueOnce(true)

    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: false,
        outputExtensions: {},
        weappViteConfig: {
          wevu: {
            minify: true,
          },
        },
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.minify).toBe(true)
    expect(isWevuMinifyEnabledMock).toHaveBeenCalledWith({
      wevu: {
        minify: true,
      },
    }, false)
  })

  it('passes dev mode to the wevu minify resolver', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        isDev: true,
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    )

    expect(options.minify).toBe(false)
    expect(isWevuMinifyEnabledMock).toHaveBeenCalledWith({}, true)
  })

  it('reuses cached compile options for the same vue entry', () => {
    createUsingComponentPathResolverMock.mockClear()
    createSfcResolveSrcOptionsMock.mockClear()

    const state = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
      compileOptionsCache: new Map(),
    }

    const first = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      state,
    )

    const second = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      state,
    )

    expect(second).toBe(first)
    expect(createUsingComponentPathResolverMock).toHaveBeenCalledTimes(1)
    expect(createSfcResolveSrcOptionsMock).toHaveBeenCalledTimes(1)
  })

  it('passes shared component metadata cache to compile options', () => {
    const componentMetaCache = new Map()
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
        componentMetaCache,
      },
    )

    expect(options.componentMetaCache).toBe(componentMetaCache)
  })

  it('caches auto import tag resolution until service version changes', async () => {
    const autoImportResolve = vi.fn(() => ({ value: { name: 'FooCard', from: '/components/foo-card' } }))
    let version = 1
    const options = createCompileVueFileOptions(
      {
        autoImportService: {
          getVersion: () => version,
          resolve: autoImportResolve,
        },
      } as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
        outputExtensions: {},
        weappViteConfig: {},
        relativeOutputPath: () => undefined,
      } as any,
      {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
        compileOptionsCache: new Map(),
      },
    )

    await options.autoImportTags.resolveUsingComponent('FooCard')
    await options.autoImportTags.resolveUsingComponent('FooCard')
    expect(autoImportResolve).toHaveBeenCalledTimes(1)

    version = 2
    await options.autoImportTags.resolveUsingComponent('FooCard')
    expect(autoImportResolve).toHaveBeenCalledTimes(2)
  })
})
