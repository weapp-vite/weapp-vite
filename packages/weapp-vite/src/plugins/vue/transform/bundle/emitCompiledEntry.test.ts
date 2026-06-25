import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MP_PLATFORM } from '../../../../platform'
import { emitCompiledVueEntryAssets, emitResolvedCompiledVueEntryAssets } from './emitCompiledEntry'

const DEFAULT_PLATFORM_ASSET_OPTIONS = {
  platform: DEFAULT_MP_PLATFORM,
  templateExtension: 'wxml',
  scriptModuleExtension: 'wxs',
}

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
  platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
})))
const emitBundlePageLayoutsIfNeededMock = vi.hoisted(() => vi.fn(async () => {}))
const emitAppShellAssetsIfNeededMock = vi.hoisted(() => vi.fn())
const emitScriptlessComponentJsFallbackIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcScriptAssetReplacingBundleEntryMock = vi.hoisted(() => vi.fn())

vi.mock('../emitAssets', () => ({
  emitSfcScriptAssetReplacingBundleEntry: emitSfcScriptAssetReplacingBundleEntryMock,
}))

vi.mock('./layoutAssets', () => ({
  emitAppShellAssetsIfNeeded: emitAppShellAssetsIfNeededMock,
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
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })
    emitBundlePageLayoutsIfNeededMock.mockReset()
    emitBundlePageLayoutsIfNeededMock.mockResolvedValue(undefined)
    emitAppShellAssetsIfNeededMock.mockReset()
    emitScriptlessComponentJsFallbackIfMissingMock.mockReset()
    emitSfcScriptAssetReplacingBundleEntryMock.mockReset()
  })

  it('emits resolved compiled page entries through shared layout flow', async () => {
    const bundle = {}
    const state = {
      ctx: {
        configService: { platform: DEFAULT_MP_PLATFORM },
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
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(handleCompiledEntryPageLayoutsMock).toHaveBeenCalledTimes(1)
    expect(result.template).toBe('<view />')
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
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })
    expect(emitScriptlessComponentJsFallbackIfMissingMock).not.toHaveBeenCalled()
  })

  it('replaces app script assets whenever app.vue participates in dev HMR emission', async () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({ old: true })',
      },
    }
    const state = {
      ctx: {
        configService: {
          isDev: true,
          platform: DEFAULT_MP_PLATFORM,
        },
        runtimeState: {
          build: {
            hmr: {
              profile: {
                event: 'create',
              },
              lastEmittedChunkFileNames: new Set<string>(),
            },
          },
        },
      },
      pluginCtx: {},
    } as any
    const cached = {
      isPage: false,
      source: '<script setup />',
    } as any
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }
    const result = { script: 'App({ routes: ["pages/logs/hmr-added"] })' } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle,
      state,
      filename: '/project/src/app.vue',
      cached,
      result,
      relativeBase: 'app',
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(emitSfcScriptAssetReplacingBundleEntryMock).toHaveBeenCalledWith(
      state.pluginCtx,
      bundle,
      'app',
      'App({ routes: ["pages/logs/hmr-added"] })',
      'js',
    )
    expect(state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('app.js')).toBe(true)
  })

  it('rewrites replaced app script assets with the remembered wevu runtime chunk', async () => {
    const bundle = {}
    const state = {
      ctx: {
        configService: {
          isDev: true,
          platform: DEFAULT_MP_PLATFORM,
        },
        runtimeState: {
          build: {
            output: {
              wevuInternalRuntimeFileName: 'weapp-vendors/wevu-watch.js',
              wevuInternalRuntimeFileNames: new Map([
                ['wevu/internal-runtime', 'weapp-vendors/wevu-watch.js'],
                ['wevu/internal-reactivity', 'weapp-vendors/wevu-ref.js'],
              ]),
            },
            hmr: {
              profile: {
                event: 'update',
              },
              lastEmittedChunkFileNames: new Set<string>(),
            },
          },
        },
      },
      pluginCtx: {},
    } as any
    const cached = {
      isPage: false,
      source: '<script setup />',
    } as any
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }
    const result = {
      script: 'import { setWevuDefaults, createApp } from "wevu/internal-runtime";import { ref } from "wevu/internal-reactivity";setWevuDefaults({});const count = ref(0);createApp({ count });',
    } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle,
      state,
      filename: '/project/src/app.vue',
      cached,
      result,
      relativeBase: 'app',
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(emitSfcScriptAssetReplacingBundleEntryMock).toHaveBeenCalledWith(
      state.pluginCtx,
      bundle,
      'app',
      'const { setWevuDefaults, createApp } = require("./weapp-vendors/wevu-watch.js");const { ref } = require("./weapp-vendors/wevu-ref.js");setWevuDefaults({});const count = ref(0);createApp({ count });',
      'js',
    )
  })

  it('replaces app script assets during auto-routes topology refreshes', async () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({ old: true })',
      },
    }
    const state = {
      ctx: {
        configService: {
          isDev: true,
          platform: DEFAULT_MP_PLATFORM,
        },
        runtimeState: {
          build: {
            hmr: {
              profile: {
                event: 'create',
                dirtyReasonSummary: ['auto-routes-topology:1'],
              },
            },
          },
        },
      },
      pluginCtx: {},
    } as any
    const cached = {
      isPage: false,
      source: '<script setup />',
    } as any
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }
    const result = { script: 'App({ routes: ["pages/logs/hmr-added"] })' } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle,
      state,
      filename: '/project/src/app.vue',
      cached,
      result,
      relativeBase: 'app',
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(emitSfcScriptAssetReplacingBundleEntryMock).toHaveBeenCalledWith(
      state.pluginCtx,
      bundle,
      'app',
      'App({ routes: ["pages/logs/hmr-added"] })',
      'js',
    )
  })

  it('replaces app script assets during direct app entry refreshes', async () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({ old: true })',
      },
    }
    const state = {
      ctx: {
        configService: {
          isDev: true,
          platform: DEFAULT_MP_PLATFORM,
        },
        runtimeState: {
          build: {
            hmr: {
              profile: {
                event: 'update',
                dirtyReasonSummary: ['entry-direct:1'],
              },
            },
          },
        },
      },
      pluginCtx: {},
    } as any
    const cached = {
      isPage: false,
      source: '<script setup />',
    } as any
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }
    const result = { script: 'App({ title: "updated" })' } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle,
      state,
      filename: '/project/src/app.vue',
      cached,
      result,
      relativeBase: 'app',
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(emitSfcScriptAssetReplacingBundleEntryMock).toHaveBeenCalledWith(
      state.pluginCtx,
      bundle,
      'app',
      'App({ title: "updated" })',
      'js',
    )
  })

  it('replaces app script assets during app json-only refreshes', async () => {
    const bundle = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'App({ old: true })',
      },
    }
    const state = {
      ctx: {
        configService: {
          isDev: true,
          platform: DEFAULT_MP_PLATFORM,
        },
        runtimeState: {
          build: {
            hmr: {
              profile: {
                event: 'update',
                dirtyReasonSummary: ['entry-json-only:1'],
              },
            },
          },
        },
      },
      pluginCtx: {},
    } as any
    const cached = {
      isPage: false,
      source: '<script setup />',
    } as any
    const compileOptionsState = {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    }
    const result = { script: 'App({ routes: ["pages/logs/hmr-added"] })' } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle,
      state,
      filename: '/project/src/app.vue',
      cached,
      result,
      relativeBase: 'app',
      compileOptionsState,
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(emitSfcScriptAssetReplacingBundleEntryMock).toHaveBeenCalledWith(
      state.pluginCtx,
      bundle,
      'app',
      'App({ routes: ["pages/logs/hmr-added"] })',
      'js',
    )
  })

  it('wraps compiled page templates with the app shell after page layouts', async () => {
    handleCompiledEntryPageLayoutsMock.mockImplementation(async ({ result, emitLayouts }: any) => {
      result.template = '<weapp-layout-default><view /></weapp-layout-default>'
      result.config = JSON.stringify({
        usingComponents: {
          'weapp-layout-default': '/layouts/default',
        },
      })
      await emitLayouts([{ kind: 'native', file: '/project/src/layouts/default' }])
    })

    const result = { template: '<view />', script: 'Page({})' } as any
    await emitResolvedCompiledVueEntryAssets({
      bundle: {},
      state: {
        ctx: {
          configService: { platform: DEFAULT_MP_PLATFORM },
        },
        pluginCtx: {},
        appShell: {
          file: '/project/src/__weapp_vite_app_shell',
          importPath: '/__weapp_vite_app_shell',
          tagName: 'weapp-app-shell',
        },
      } as any,
      filename: '/project/src/pages/index/index.vue',
      cached: {
        isPage: true,
        source: '<template><view /></template>',
      } as any,
      result,
      relativeBase: 'pages/index/index',
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(result.template).toBe('<weapp-app-shell __wvSlotOwnerId="{{__wvSlotOwnerId || __wvOwnerId || \'\'}}"><weapp-layout-default><view /></weapp-layout-default></weapp-app-shell>')
    expect(JSON.parse(result.config)).toEqual({
      usingComponents: {
        'weapp-layout-default': '/layouts/default',
        'weapp-app-shell': '/__weapp_vite_app_shell',
      },
    })
  })

  it('keeps app.vue without template compatible with the normal app entry flow', async () => {
    const result = {
      config: JSON.stringify({ pages: ['pages/index/index'] }),
      script: 'createApp({})',
    } as any

    await emitResolvedCompiledVueEntryAssets({
      bundle: {},
      state: {
        ctx: {
          configService: { platform: DEFAULT_MP_PLATFORM },
        },
        pluginCtx: {},
      } as any,
      filename: '/project/src/app.vue',
      cached: {
        isPage: false,
        source: '<script setup>defineAppJson({ pages: [\'pages/index/index\'] })</script>',
      } as any,
      result,
      relativeBase: 'app',
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
      outputExtensions: { wxml: 'wxml' } as any,
      templateExtension: 'wxml',
      jsonExtension: 'json',
      scriptExtension: 'js',
      scriptModuleExtension: 'wxs',
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
    })

    expect(emitAppShellAssetsIfNeededMock).not.toHaveBeenCalled()
    expect(handleCompiledEntryPageLayoutsMock).not.toHaveBeenCalled()
    expect(emitCompiledEntryBundleAssetsMock).toHaveBeenCalledWith(expect.objectContaining({
      filename: '/project/src/app.vue',
      relativeBase: 'app',
      result,
      isPage: false,
    }))
  })

  it('emits scriptless component fallbacks for component entries without script', async () => {
    emitCompiledEntryBundleAssetsMock.mockReturnValue({
      shouldEmitComponentJson: true,
    })

    await emitResolvedCompiledVueEntryAssets({
      bundle: {},
      state: {
        ctx: {
          configService: { platform: DEFAULT_MP_PLATFORM },
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
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
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
      platformAssetOptions: DEFAULT_PLATFORM_ASSET_OPTIONS,
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
        configService: { platform: DEFAULT_MP_PLATFORM },
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
        configService: { platform: DEFAULT_MP_PLATFORM },
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
