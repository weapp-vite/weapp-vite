import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as uniApp from '../../../uniApp'
import { SLOT_HOST_SCRIPTLESS_COMPONENT_STUB } from '../../../utils/scriptlessComponent'
import { withCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { createBundleLayoutEmitters, emitAppShellAssetsIfNeeded, emitBundlePageLayoutsIfNeeded, emitNativeLayoutAssetsIfNeeded, emitResolvedBundleLayouts, emitResolvedNativeLayoutStaticAssets, emitVueLayoutScriptFallbackIfNeeded, resolveNativeLayoutAssetState, resolveVueLayoutAssetOptions, resolveVueLayoutScriptFallbackState } from './layoutAssets'

const readFileMock = vi.hoisted(() => vi.fn(async () => '<view><slot /></view>'))
const collectNativeLayoutAssetsMock = vi.hoisted(() => vi.fn(async () => ({
  template: '/project/layouts/default/index.wxml',
})))
const emitSfcTemplateIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcStyleIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const emitBundleVueEntryAssetsMock = vi.hoisted(() => vi.fn())
const emitSharedVueEntryJsonAssetMock = vi.hoisted(() => vi.fn())
const compileVueLikeFileMock = vi.hoisted(() => vi.fn(async () => ({
  script: '',
  template: '<view><slot /></view>',
})))
const ensureScriptlessComponentAssetMock = vi.hoisted(() => vi.fn())

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

vi.mock('../pageLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pageLayout')>()
  return {
    ...actual,
    collectNativeLayoutAssets: collectNativeLayoutAssetsMock,
  }
})

vi.mock('../emitAssets', () => ({
  emitSfcJsonAsset: emitSfcJsonAssetMock,
  emitSfcStyleIfMissing: emitSfcStyleIfMissingMock,
  emitSfcTemplateIfMissing: emitSfcTemplateIfMissingMock,
}))

vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shared')>()
  return {
    ...actual,
    compileVueLikeFile: compileVueLikeFileMock,
  }
})

vi.mock('./shared/assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shared/assets')>()
  return {
    ...actual,
    emitBundleVueEntryAssets: emitBundleVueEntryAssetsMock,
    emitSharedVueEntryJsonAsset: emitSharedVueEntryJsonAssetMock,
  }
})

vi.mock('../../../utils/scriptlessComponent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/scriptlessComponent')>()
  return {
    ...actual,
    ensureScriptlessComponentAsset: ensureScriptlessComponentAssetMock,
  }
})

describe('resolveVueLayoutAssetOptions', () => {
  beforeEach(() => {
    readFileMock.mockReset()
    readFileMock.mockResolvedValue('<view><slot /></view>')
    collectNativeLayoutAssetsMock.mockReset()
    collectNativeLayoutAssetsMock.mockResolvedValue({
      template: '/project/layouts/default/index.wxml',
    })
    emitSfcTemplateIfMissingMock.mockReset()
    emitSfcStyleIfMissingMock.mockReset()
    emitSfcJsonAssetMock.mockReset()
    emitBundleVueEntryAssetsMock.mockReset()
    emitSharedVueEntryJsonAssetMock.mockReset()
    compileVueLikeFileMock.mockReset()
    compileVueLikeFileMock.mockResolvedValue({
      script: '',
      template: '<view><slot /></view>',
    })
    ensureScriptlessComponentAssetMock.mockReset()
  })

  it('resolves layout asset output names from platform extensions', () => {
    expect(resolveVueLayoutAssetOptions({
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      layoutBasePath: 'layouts/default/index',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'js',
        wxs: 'sjs',
      },
    })).toEqual({
      relativeBase: 'dist/layouts/default/index',
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'sjs',
    })
  })

  it('returns undefined when relative output path is unavailable', () => {
    expect(resolveVueLayoutAssetOptions({
      configService: {
        relativeOutputPath: () => '',
      } as any,
      layoutBasePath: 'layouts/default/index',
      outputExtensions: undefined,
    })).toBeUndefined()
  })

  it('resolves vue layout script fallback state from output options and bundle state', () => {
    expect(resolveVueLayoutScriptFallbackState({
      bundle: {},
      layoutFilePath: '/project/layouts/vue-default/index.vue',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).toEqual({
      resolvedOptions: {
        relativeBase: 'dist//project/layouts/vue-default/index',
        templateExtension: 'wxml',
        styleExtension: 'wxss',
        jsonExtension: 'json',
        scriptExtension: 'mjs',
        scriptModuleExtension: 'wxs',
      },
      scriptFileName: 'dist//project/layouts/vue-default/index.mjs',
    })
  })

  it('resolves native layout asset state from layout assets and output options', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValue({
      json: '/project/layouts/default/index.json',
      template: '/project/layouts/default/index.wxml',
    })

    await expect(resolveNativeLayoutAssetState({
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'js',
      } as any,
    })).resolves.toEqual({
      resolvedOptions: {
        relativeBase: 'dist/layouts/default/index',
        templateExtension: 'axml',
        styleExtension: 'acss',
        jsonExtension: 'json',
        scriptExtension: 'js',
        scriptModuleExtension: 'wxs',
      },
      assets: {
        json: '/project/layouts/default/index.json',
        template: '/project/layouts/default/index.wxml',
      },
    })
  })

  it('returns undefined for native layout asset state when output options cannot be resolved', async () => {
    await expect(resolveNativeLayoutAssetState({
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: () => '',
      } as any,
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'js',
      } as any,
    })).resolves.toBeUndefined()
  })

  it('emits resolved native layout static assets by asset kind', async () => {
    readFileMock.mockImplementation(async (file: string) => {
      if (file.endsWith('.wxml')) {
        return '<view><slot /></view>'
      }
      return '.layout{}'
    })

    await emitResolvedNativeLayoutStaticAssets({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      assets: {
        template: '/project/layouts/default/index.wxml',
        style: '/project/layouts/default/index.wxss',
      } as any,
      resolvedOptions: {
        relativeBase: 'dist/layouts/default/index',
        templateExtension: 'wxml',
        styleExtension: 'wxss',
        jsonExtension: 'json',
        scriptExtension: 'js',
        scriptModuleExtension: 'wxs',
      },
    })

    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist/layouts/default/index',
      '<view><slot /></view>',
      'wxml',
    )
    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist/layouts/default/index',
      '.layout{}',
      'wxss',
    )
  })

  it('returns undefined for vue layout script fallback when asset already exists in bundle', () => {
    expect(resolveVueLayoutScriptFallbackState({
      bundle: {
        'dist//project/layouts/vue-default/index.mjs': { type: 'chunk' },
      },
      layoutFilePath: '/project/layouts/vue-default/index.vue',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).toBeUndefined()
  })

  it('returns undefined for vue layout script fallback when output options cannot be resolved', () => {
    expect(resolveVueLayoutScriptFallbackState({
      bundle: {},
      layoutFilePath: '/project/layouts/vue-default/index.vue',
      configService: {
        relativeOutputPath: () => '',
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).toBeUndefined()
  })

  it('returns early for vue layout fallback when shared state cannot be resolved', async () => {
    await emitVueLayoutScriptFallbackIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      layoutFilePath: '/project/layouts/vue-default/index.vue',
      ctx: {} as any,
      configService: {
        relativeOutputPath: () => '',
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: {
        js: 'mjs',
      } as any,
    })

    expect(readFileMock).not.toHaveBeenCalledWith('/project/layouts/vue-default/index.vue', 'utf8')
    expect(compileVueLikeFileMock).not.toHaveBeenCalled()
  })

  it('returns early for vue layout fallback when compiled script already exists', async () => {
    compileVueLikeFileMock.mockResolvedValue({
      script: 'Component({})',
      template: '<view><slot /></view>',
    })

    await emitVueLayoutScriptFallbackIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      layoutFilePath: '/project/layouts/vue-default/index.vue',
      ctx: {} as any,
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: {
        js: 'mjs',
      } as any,
    })

    expect(readFileMock).toHaveBeenCalledWith('/project/layouts/vue-default/index.vue', 'utf8')
    expect(ensureScriptlessComponentAssetMock).not.toHaveBeenCalled()
  })

  it('throws for vue layout fallback without default slot', async () => {
    compileVueLikeFileMock.mockResolvedValue({
      script: '',
      template: '<view />',
    })

    await expect(emitVueLayoutScriptFallbackIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      layoutFilePath: '/project/layouts/vue-default/index.vue',
      ctx: {} as any,
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).rejects.toThrow('/project/layouts/vue-default/index.vue 对应的 layout template 必须包含默认 <slot />')
  })

  it('compiles a scriptless layout from prepared frozen input instead of later disk bytes', async () => {
    const layoutFilePath = '/project/layouts/vue-default/index.vue'
    const rawSource = `<template>
<!-- #ifdef MP-WEIXIN -->
<view><slot /></view>
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<Child><template #default="{ value }">{{ value }}</template></Child>
<!-- #endif -->
</template>`
    const configService = {
      absoluteSrcRoot: '/project',
      platform: 'weapp',
      weappViteConfig: { uniApp: { include: [] } },
      relativeOutputPath: (value: string) => `dist/${value}`,
    } as any
    readFileMock.mockResolvedValue('<template><view>later disk content</view></template>')

    await withCompilerSourceSnapshot(configService, new Map([[layoutFilePath, rawSource]]), async () => {
      await emitVueLayoutScriptFallbackIfNeeded({
        pluginCtx: { emitFile: vi.fn() },
        bundle: {},
        layoutFilePath,
        ctx: {} as any,
        configService,
        compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
        outputExtensions: { js: 'js' } as any,
      })
    })

    const options = (compileVueLikeFileMock.mock.calls as unknown as Array<{ source: string, rawSource: string }[]>)[0]?.[0]
    expect(options?.rawSource).toBe(rawSource)
    expect(options?.source).toContain('<view><slot /></view>')
    expect(options?.source).not.toContain('<Child>')
    expect(options?.source).not.toContain('later disk content')
    expect(readFileMock).not.toHaveBeenCalled()
    expect(ensureScriptlessComponentAssetMock).toHaveBeenCalledTimes(1)
  })

  it('propagates scriptless layout compatibility preparation errors', async () => {
    const failure = new uniApp.UniAppCompatibilityTransformError('invalid layout input', new Error('parse'))
    const prepare = vi.spyOn(uniApp, 'transformUniAppCompatibilitySource').mockImplementationOnce(() => {
      throw failure
    })
    try {
      await expect(emitVueLayoutScriptFallbackIfNeeded({
        pluginCtx: { emitFile: vi.fn() },
        bundle: {},
        layoutFilePath: '/project/layouts/vue-default/index.vue',
        ctx: {} as any,
        configService: { relativeOutputPath: (value: string) => `dist/${value}` } as any,
        compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
        outputExtensions: { js: 'js' } as any,
      })).rejects.toBe(failure)
      expect(compileVueLikeFileMock).not.toHaveBeenCalled()
      expect(ensureScriptlessComponentAssetMock).not.toHaveBeenCalled()
    }
    finally {
      prepare.mockRestore()
    }
  })

  it('emits native layout assets including json when present', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValue({
      json: '/project/layouts/default/index.json',
      template: '/project/layouts/default/index.wxml',
    })
    readFileMock.mockImplementation(async (file: string) => {
      if (file.endsWith('.json')) {
        return '{"component":true}'
      }
      return '<view><slot /></view>'
    })

    await emitNativeLayoutAssetsIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        json: 'json',
        js: 'js',
      } as any,
    })

    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist/layouts/default/index',
      { config: '{"component":true}' },
      {
        emitIfMissingOnly: true,
        extension: 'json',
        kind: 'component',
      },
    )
  })

  it('returns early for native layout assets when layout output options are unavailable', async () => {
    await emitNativeLayoutAssetsIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: () => '',
      } as any,
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        json: 'json',
        js: 'js',
      } as any,
    })

    expect(emitSfcJsonAssetMock).not.toHaveBeenCalled()
    expect(emitSfcTemplateIfMissingMock).not.toHaveBeenCalled()
    expect(emitSfcStyleIfMissingMock).not.toHaveBeenCalled()
  })

  it('creates bundle layout emitters for native and vue layout paths', async () => {
    const emitters = createBundleLayoutEmitters({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      ctx: {} as any,
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        json: 'json',
        js: 'js',
      },
    })

    await emitters.emitNativeLayout('layouts/native-default/index')
    await emitters.emitVueLayout('/project/layouts/vue-default/index.vue')

    expect(collectNativeLayoutAssetsMock).toHaveBeenCalledWith('layouts/native-default/index', undefined)
    expect(compileVueLikeFileMock).toHaveBeenCalledTimes(1)
  })

  it('dispatches resolved bundle layouts by layout kind', async () => {
    const emitNativeLayout = vi.fn(async () => {})
    const emitVueLayout = vi.fn(async () => {})

    await emitResolvedBundleLayouts({
      layouts: [
        { kind: 'native', file: '/layouts/native-default' },
        { kind: 'vue', file: '/layouts/vue-default.vue' },
        { kind: 'native', file: '/layouts/native-second' },
      ],
      emitNativeLayout,
      emitVueLayout,
    })

    expect(emitNativeLayout).toHaveBeenCalledTimes(2)
    expect(emitNativeLayout).toHaveBeenNthCalledWith(1, '/layouts/native-default')
    expect(emitNativeLayout).toHaveBeenNthCalledWith(2, '/layouts/native-second')
    expect(emitVueLayout).toHaveBeenCalledTimes(1)
    expect(emitVueLayout).toHaveBeenCalledWith('/layouts/vue-default.vue')
  })

  it('returns early when bundle page layouts are missing', async () => {
    await emitBundlePageLayoutsIfNeeded({
      layouts: undefined,
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      ctx: {} as any,
      configService: {} as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: {},
    })

    expect(collectNativeLayoutAssetsMock).not.toHaveBeenCalled()
    expect(compileVueLikeFileMock).not.toHaveBeenCalled()
    expect(ensureScriptlessComponentAssetMock).not.toHaveBeenCalled()
  })

  it('emits app shell component assets that consume app-level styles', () => {
    const bundle = {}

    emitAppShellAssetsIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle,
      ctx: {} as any,
      filename: '/project/src/app.vue',
      relativeBase: '__weapp_vite_app_shell',
      result: {
        template: '<view class="happy"><slot /></view>',
        style: '.happy{padding:8px;}',
        config: undefined,
        classStyleWxs: undefined,
        scopedSlotComponents: [],
      },
      configService: {} as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      outputExtensions: {
        wxss: 'wxss',
      } as any,
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: 'wxml',
      },
    })

    expect(emitBundleVueEntryAssetsMock).toHaveBeenCalledWith(expect.objectContaining({
      filename: '__weapp_vite_app_shell',
      relativeBase: '__weapp_vite_app_shell',
    }))
    expect(emitSfcStyleIfMissingMock).not.toHaveBeenCalled()
    expect(emitSharedVueEntryJsonAssetMock).toHaveBeenCalledWith(expect.objectContaining({
      relativeBase: '__weapp_vite_app_shell',
      config: JSON.stringify({
        styleIsolation: 'apply-shared',
      }, null, 2),
    }))
  })

  it.each([
    { platform: 'weapp', nativeSlotContext: true, scopedSlotsRequireProps: true, emitsStub: false },
    { platform: 'weapp', nativeSlotContext: false, scopedSlotsRequireProps: true, emitsStub: true },
    { platform: 'weapp', nativeSlotContext: true, scopedSlotsRequireProps: false, emitsStub: true },
    { platform: 'alipay', nativeSlotContext: true, scopedSlotsRequireProps: true, emitsStub: true },
  ])('preserves app shell runtime and assets with native slot options ($platform, native=$nativeSlotContext, scoped=$scopedSlotsRequireProps)', ({ platform, nativeSlotContext, scopedSlotsRequireProps, emitsStub }) => {
    const relativeBase = '__weapp_vite_app_shell'
    const shellChunk = {
      type: 'chunk',
      fileName: `${relativeBase}.js`,
      code: 'Component({ methods: { __weapp_vite_nativeSlotParent() {} } })',
    }
    const bundle = { [`${relativeBase}.js`]: shellChunk }
    const pluginCtx = { emitFile: vi.fn() }
    const result = {
      template: '<app-shell-card class="happy"><slot /></app-shell-card>',
      style: '.happy{padding:8px;}',
      config: JSON.stringify({
        pages: ['pages/index/index'],
        window: { navigationBarTitleText: 'Home' },
        usingComponents: {
          'app-shell-card': '/components/app-shell-card/index',
          'custom-tab-bar': '/custom-tab-bar/index',
        },
        componentGenerics: { card: true },
      }),
      classStyleWxs: undefined,
      scopedSlotComponents: [],
    }

    emitAppShellAssetsIfNeeded({
      pluginCtx,
      bundle,
      ctx: {} as any,
      filename: '/project/src/app.vue',
      relativeBase,
      result,
      configService: {
        platform,
        weappViteConfig: {
          vue: { template: { nativeSlotContext, scopedSlotsRequireProps } },
        },
      } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      outputExtensions: { wxss: 'wxss' } as any,
      platformAssetOptions: {
        platform,
        templateExtension: 'wxml',
      },
    })

    if (emitsStub) {
      expect(ensureScriptlessComponentAssetMock).toHaveBeenCalledWith(
        pluginCtx,
        bundle,
        relativeBase,
        'js',
        SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
      )
    }
    else {
      expect(ensureScriptlessComponentAssetMock).not.toHaveBeenCalled()
    }
    expect(bundle[`${relativeBase}.js`]).toBe(shellChunk)
    expect(shellChunk.code).toContain('__weapp_vite_nativeSlotParent')
    expect(emitBundleVueEntryAssetsMock).toHaveBeenCalledWith(expect.objectContaining({
      bundle,
      filename: relativeBase,
      relativeBase,
      result,
    }))
    expect(emitSfcStyleIfMissingMock).not.toHaveBeenCalled()
    expect(emitSharedVueEntryJsonAssetMock).toHaveBeenCalledWith(expect.objectContaining({
      relativeBase,
      config: JSON.stringify({
        styleIsolation: 'apply-shared',
        usingComponents: {
          'app-shell-card': '/components/app-shell-card/index',
        },
        componentGenerics: { card: true },
      }, null, 2),
      jsonOptions: {
        defaultConfig: { component: true },
        kind: 'component',
        extension: 'json',
      },
    }))
  })

  it('keeps only components referenced by the app shell template', () => {
    emitAppShellAssetsIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      ctx: {} as any,
      filename: '/project/src/app.vue',
      relativeBase: '__weapp_vite_app_shell',
      result: {
        template: '<app-shell-card><slot /></app-shell-card>',
        style: '',
        config: JSON.stringify({
          usingComponents: {
            'app-shell-card': '/components/app-shell-card/index',
            'custom-tab-bar': '/custom-tab-bar/index',
          },
        }),
        classStyleWxs: undefined,
        scopedSlotComponents: [],
      },
      configService: {} as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      outputExtensions: {
        wxss: 'wxss',
      } as any,
      platformAssetOptions: {
        platform: 'weapp',
        templateExtension: 'wxml',
      },
    })

    expect(emitSharedVueEntryJsonAssetMock).toHaveBeenCalledWith(expect.objectContaining({
      relativeBase: '__weapp_vite_app_shell',
      config: JSON.stringify({
        styleIsolation: 'apply-shared',
        usingComponents: {
          'app-shell-card': '/components/app-shell-card/index',
        },
      }, null, 2),
    }))
  })

  it('dispatches bundle page layouts through shared native and vue emit flows', async () => {
    await emitBundlePageLayoutsIfNeeded({
      layouts: [
        { kind: 'native', file: 'layouts/native-default/index' },
        { kind: 'vue', file: '/project/layouts/vue-default/index.vue' },
      ],
      pluginCtx: { emitFile: vi.fn() },
      bundle: {},
      ctx: {} as any,
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        json: 'json',
        js: 'js',
      },
    })

    expect(collectNativeLayoutAssetsMock).toHaveBeenCalledWith('layouts/native-default/index', undefined)
    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist/layouts/native-default/index',
      '<view><slot /></view>',
      'wxml',
    )
    expect(readFileMock).toHaveBeenCalledWith('/project/layouts/vue-default/index.vue', 'utf8')
    expect(compileVueLikeFileMock).toHaveBeenCalledTimes(1)
    expect(ensureScriptlessComponentAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist//project/layouts/vue-default/index',
      'js',
      SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
    )
  })
})
