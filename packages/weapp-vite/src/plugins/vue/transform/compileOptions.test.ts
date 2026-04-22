import { describe, expect, it, vi } from 'vitest'
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
const resolveWevuDefaultsWithPresetMock = vi.hoisted(() => vi.fn(() => ({
  preset: 'default',
})))

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

vi.mock('./usingComponentResolver', () => ({
  createUsingComponentPathResolver: createUsingComponentPathResolverMock,
}))

vi.mock('./wevuPreset', () => ({
  resolveWevuDefaultsWithPreset: resolveWevuDefaultsWithPresetMock,
}))

describe('resolveVueTemplatePlatformOptions', () => {
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
              classStyleRuntime: 'auto',
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
    expect(options.template.wxsExtension).toBe('sjs')
    expect(options.template.classStyleWxsSrc).toBe('/virtual/__class_style__.wxs')
    expect(options.template.scopedSlotsRequireProps).toBe(false)
    expect(options.template.slotSingleRootNoWrapper).toBe(true)
    expect(options.json).toEqual({
      kind: 'page',
      defaults: {
        page: { navigationBarTitleText: 'demo' },
      },
      mergeStrategy: 'merge',
    })
    expect(options.wevuDefaults).toEqual({ preset: 'default' })
    expect(createUsingComponentPathResolverMock).toHaveBeenCalled()
    expect(await options.autoImportTags.resolveUsingComponent('FooCard')).toEqual({
      name: 'FooCard',
      from: '/components/foo-card',
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
    expect(options.json.kind).toBe('component')
    expect(await options.autoImportTags.resolveUsingComponent('Missing')).toBeUndefined()
    expect(await options.sfcSrc.resolveId('./source.vue', '/project/src/components/card.vue')).toBeUndefined()
    expect(state.value).toBe(true)
    expect(loggerWarnMock).toHaveBeenCalled()
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

  it('allows disabling mapped tag class injection in compile options', () => {
    const options = createCompileVueFileOptions(
      {} as any,
      {} as any,
      '/project/src/components/card.vue',
      false,
      false,
      {
        platform: 'weapp',
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
})
