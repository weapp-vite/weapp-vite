import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../helpers'
import { runInNewContext } from 'node:vm'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createGenerateBundleHook } from './emit/generate'

function fixture() {
  const root = path.resolve('classic-core-publication-fixture')
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.isRebuild = true
  runtimeState.build.hmr.forceEmitUnchangedChunks = false
  return {
    ctx: {
      currentBuildTarget: 'app',
      runtimeState,
      scanService: { subPackageMap: new Map() },
      configService: {
        cwd: root,
        outDir: path.join(root, 'dist'),
        isDev: true,
        platform: 'weapp',
        packageJson: { dependencies: {} },
        projectPrivateConfig: { setting: { compileHotReLoad: true } },
        weappViteConfig: {
          hmr: { runtime: 'classic' },
          appPrelude: false,
          injectWeapi: { enabled: true, replaceWx: true, globalName: 'wpi' },
        },
        relativeAbsoluteSrcRoot: (id: string) => id,
      },
    },
    resolvedConfig: { root, build: { outDir: 'dist', write: true } },
    entriesMap: new Map(),
    watchFilesSnapshot: [],
    hmrState: {
      hasBuiltOnce: true,
      didEmitAllEntries: false,
      skipSharedChunkRefresh: true,
      lastHmrEntryIds: new Set(['pages/active/index.ts']),
      lastEmittedEntryIds: new Set(),
      affectedSharedChunkIds: new Set(),
    },
    hmrSharedChunksMode: 'auto',
    hmrSharedChunkImporters: new Map(),
    hmrSharedChunksByEntry: new Map(),
    hmrSharedChunkDependencies: new Map(),
    outputChunksByModule: new Map(),
  } as unknown as CorePluginState
}

function bundle() {
  const chunks = ['app', 'pages/active/index', 'pages/inactive/index'].map(name => [`${name}.js`, {
    type: 'chunk',
    fileName: `${name}.js`,
    facadeModuleId: `${name}.ts`,
    isEntry: true,
    code: `exports.value = wx.getStorageSync(${JSON.stringify(name)})`,
    imports: [],
    dynamicImports: [],
    exports: ['value'],
    modules: {},
  }])
  return {
    ...Object.fromEntries(chunks),
    'pages/active/index.wxml': { type: 'asset', fileName: 'pages/active/index.wxml', source: '<view>updated template</view>' },
  } as OutputBundle
}

function expectInjectedApi(chunk: OutputChunk) {
  const getStorageSync = vi.fn((key: string) => `injected:${key}`)
  const nativeGetStorageSync = vi.fn((key: string) => `native:${key}`)
  const exports = { value: undefined as unknown }
  runInNewContext(chunk.code, { exports, wpi: { getStorageSync }, wx: { getStorageSync: nativeGetStorageSync } })
  const key = chunk.fileName.replace(/\.js$/, '')
  expect(getStorageSync).toHaveBeenCalledExactlyOnceWith(key)
  expect(nativeGetStorageSync).not.toHaveBeenCalled()
  expect(exports.value).toBe(`injected:${key}`)
}

describe('classic native root publication during incremental generation', () => {
  beforeEach(() => {
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps native metadata-only chunks through complete platform and runtime conversion', async () => {
    const state = fixture()
    const output = bundle()
    await createGenerateBundleHook(state, false).call({}, {}, output)
    expect(Object.keys(output).sort()).toEqual(['app.js', 'pages/active/index.js', 'pages/active/index.wxml', 'pages/inactive/index.js'])
    for (const item of Object.values(output)) {
      if (item.type === 'chunk') {
        expectInjectedApi(item)
      }
    }
    expect(state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.size).toBe(0)
  })

  it('converts the native app input during a partial script update even when only the page was emitted dynamically', async () => {
    const state = fixture()
    state.hmrState.skipSharedChunkRefresh = false
    state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add('pages/active/index.js')
    const output = bundle()
    await createGenerateBundleHook(state, false).call({}, {}, output)
    expectInjectedApi(output['app.js'] as OutputChunk)
    expectInjectedApi(output['pages/active/index.js'] as OutputChunk)
    expect(output['pages/inactive/index.js']).toBeUndefined()
  })

  it.each(['stateful', 'snapshot', 'child', 'other-platform', 'plugin-target'] as const)('retains metadata-only pruning outside native classic app publication: %s', async (scope) => {
    const state = fixture()
    if (scope === 'stateful') {
      state.ctx.configService.weappViteConfig.hmr!.runtime = 'stateful-experimental'
    }
    else if (scope === 'snapshot') {
      state.resolvedConfig!.build.write = false
    }
    else if (scope === 'child') {
      state.subPackageMeta = { subPackage: { root: 'independent' } } as CorePluginState['subPackageMeta']
    }
    else if (scope === 'other-platform') {
      Object.assign(state.ctx.configService, { platform: 'alipay' })
    }
    else {
      state.ctx.currentBuildTarget = 'plugin'
    }
    const output = bundle()
    await createGenerateBundleHook(state, false).call({}, {}, output)
    expect(Object.values(output).some(item => item.type === 'chunk')).toBe(false)
    expect(output['pages/active/index.wxml']).toBeDefined()
  })
})
