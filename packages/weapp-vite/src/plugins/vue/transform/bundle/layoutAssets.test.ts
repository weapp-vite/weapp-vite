import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBundleLayoutEmitters, emitBundlePageLayoutsIfNeeded, emitNativeLayoutAssetsIfNeeded, emitNativeLayoutScriptChunkIfNeeded, emitResolvedBundleLayouts, emitResolvedNativeLayoutStaticAssets, emitVueLayoutScriptFallbackIfNeeded, resolveNativeLayoutAssetState, resolveNativeLayoutScriptChunkState, resolveVueLayoutAssetOptions, resolveVueLayoutScriptFallbackState } from './layoutAssets'

const readFileMock = vi.hoisted(() => vi.fn(async () => '<view />'))
const collectNativeLayoutAssetsMock = vi.hoisted(() => vi.fn(async () => ({
  template: '/project/layouts/default/index.wxml',
})))
const emitSfcTemplateIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcStyleIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const compileVueLikeFileMock = vi.hoisted(() => vi.fn(async () => ({
  script: '',
})))
const ensureScriptlessComponentAssetMock = vi.hoisted(() => vi.fn())
const emitNativeLayoutScriptChunkIfNeededSharedMock = vi.hoisted(() => vi.fn())

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

vi.mock('../pageLayout', () => ({
  collectNativeLayoutAssets: collectNativeLayoutAssetsMock,
}))

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

vi.mock('../../../utils/scriptlessComponent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/scriptlessComponent')>()
  return {
    ...actual,
    ensureScriptlessComponentAsset: ensureScriptlessComponentAssetMock,
  }
})

vi.mock('../../../utils/nativeLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/nativeLayout')>()
  return {
    ...actual,
    emitNativeLayoutScriptChunkIfNeeded: emitNativeLayoutScriptChunkIfNeededSharedMock,
  }
})

describe('resolveVueLayoutAssetOptions', () => {
  beforeEach(() => {
    readFileMock.mockReset()
    readFileMock.mockResolvedValue('<view />')
    collectNativeLayoutAssetsMock.mockReset()
    collectNativeLayoutAssetsMock.mockResolvedValue({
      template: '/project/layouts/default/index.wxml',
    })
    emitSfcTemplateIfMissingMock.mockReset()
    emitSfcStyleIfMissingMock.mockReset()
    emitSfcJsonAssetMock.mockReset()
    compileVueLikeFileMock.mockReset()
    compileVueLikeFileMock.mockResolvedValue({
      script: '',
    })
    ensureScriptlessComponentAssetMock.mockReset()
    emitNativeLayoutScriptChunkIfNeededSharedMock.mockReset()
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

  it('resolves native layout script chunk state from layout assets and output options', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValue({
      script: '/project/layouts/default/index.js',
    })

    await expect(resolveNativeLayoutScriptChunkState({
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).resolves.toEqual({
      fileName: 'dist/layouts/default/index.mjs',
      scriptId: '/project/layouts/default/index.js',
    })
  })

  it('returns undefined for native layout script chunk state when script asset is missing', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValue({
      template: '/project/layouts/default/index.wxml',
    })

    await expect(resolveNativeLayoutScriptChunkState({
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).resolves.toBeUndefined()
  })

  it('returns undefined for native layout script chunk state when output options cannot be resolved', async () => {
    await expect(resolveNativeLayoutScriptChunkState({
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: () => '',
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })).resolves.toBeUndefined()
  })

  it('returns early when native layout script chunk state is missing', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValue({
      template: '/project/layouts/default/index.wxml',
    })

    await emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })

    expect(emitSfcJsonAssetMock).not.toHaveBeenCalled()
  })

  it('emits native layout script chunk through shared chunk emitter', async () => {
    collectNativeLayoutAssetsMock.mockResolvedValue({
      script: '/project/layouts/default/index.js',
    })

    await emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx: { emitFile: vi.fn() },
      layoutBasePath: 'layouts/default/index',
      configService: {
        relativeOutputPath: (value: string) => `dist/${value}`,
      } as any,
      outputExtensions: {
        js: 'mjs',
      } as any,
    })

    expect(emitNativeLayoutScriptChunkIfNeededSharedMock).toHaveBeenCalledWith({
      pluginCtx: expect.anything(),
      scriptId: '/project/layouts/default/index.js',
      fileName: 'dist/layouts/default/index.mjs',
    })
  })

  it('emits resolved native layout static assets by asset kind', async () => {
    readFileMock.mockImplementation(async (file: string) => {
      if (file.endsWith('.wxml')) {
        return '<view />'
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
      '<view />',
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

    expect(readFileMock).not.toHaveBeenCalledWith('/project/layouts/vue-default/index.vue', 'utf-8')
    expect(compileVueLikeFileMock).not.toHaveBeenCalled()
  })

  it('returns early for vue layout fallback when compiled script already exists', async () => {
    compileVueLikeFileMock.mockResolvedValue({
      script: 'Component({})',
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

    expect(readFileMock).toHaveBeenCalledWith('/project/layouts/vue-default/index.vue', 'utf-8')
    expect(ensureScriptlessComponentAssetMock).not.toHaveBeenCalled()
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
      return '<view />'
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

    expect(collectNativeLayoutAssetsMock).toHaveBeenCalledWith('layouts/native-default/index')
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

    expect(collectNativeLayoutAssetsMock).toHaveBeenCalledWith('layouts/native-default/index')
    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist/layouts/native-default/index',
      '<view />',
      'wxml',
    )
    expect(readFileMock).toHaveBeenCalledWith('/project/layouts/vue-default/index.vue', 'utf-8')
    expect(compileVueLikeFileMock).toHaveBeenCalledTimes(1)
    expect(ensureScriptlessComponentAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'dist//project/layouts/vue-default/index',
      'js',
    )
  })
})
