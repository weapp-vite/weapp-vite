import type { OutputBundle, OutputChunk } from 'rolldown'
import type { SubPackageMetaValue } from '../../../types'
import type { CorePluginState } from '../helpers'
import { createContext, runInContext, runInNewContext } from 'node:vm'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../../runtime/config/internal/injectRequestGlobals'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { pruneUnchangedDevHmrOutputs } from '../../outputFinalizer/hmrPrune'
import { collectAffectedSharedChunkEntriesAndChunks } from '../helpers'
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

function executePreludePublication(publication: OutputBundle, entries = ['app.js', 'pages/active/index.js']) {
  const context = createContext({})
  const cache = new Map<string, { exports: Record<string, unknown> }>()
  const load = (file: string): Record<string, unknown> => {
    const previous = cache.get(file)
    if (previous) {
      return previous.exports
    }
    const output = publication[file]
    if (!output) {
      throw new Error(`Missing native publication module: ${file}`)
    }
    const module = { exports: {} }
    cache.set(file, module)
    const source = output.type === 'chunk' ? output.code : String(output.source)
    runInContext(`(function(module, exports, require) {\n${source}\n})`, context)(module, module.exports, (request: string) => {
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), request)))
    })
    return module.exports
  }
  return Object.fromEntries(entries.map(file => [file, load(file)]))
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

  it.each([false, true])('refreshes compiled shared dependencies independently of logical HMR owners (peer compiled=%s)', async (peerCompiled) => {
    const state = fixture()
    const sourceRoot = path.join(state.resolvedConfig!.root, 'src')
    const active = path.join(sourceRoot, 'pages/active/index.ts')
    const peer = path.join(sourceRoot, 'pages/inactive/index.ts')
    const dependency = path.join(sourceRoot, 'shared/current.ts')
    const previous = 'weapp-vendors/previous.js'
    const current = 'weapp-vendors/current.js'
    const compiled = new Set(peerCompiled ? [active, peer] : [active])
    state.ctx.configService.absoluteSrcRoot = sourceRoot
    state.ctx.configService.weappViteConfig.injectWeapi = false
    state.resolvedEntryMap = new Map([active, peer].map(id => [id, { id }]))
    state.hmrSourceSharedChunks = new Set()
    state.hmrState.skipSharedChunkRefresh = false
    state.hmrState.lastHmrEntryIds = new Set([active])
    state.hmrState.lastEmittedEntryIds = compiled
    state.hmrSharedChunkImporters.set(previous, new Set([active, peer]))
    for (const id of [active, peer]) {
      state.hmrSharedChunksByEntry.set(id, new Set([previous]))
    }
    const output = bundle()
    for (const [fileName, entryId] of [['pages/active/index.js', active], ['pages/inactive/index.js', peer]]) {
      if (!compiled.has(entryId!)) {
        delete output[fileName!]
        continue
      }
      Object.assign(output[fileName!], {
        facadeModuleId: entryId,
        code: 'exports.value = require("../../weapp-vendors/current.js").value;',
        imports: [current],
      })
      state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.add(fileName!)
    }
    output[current] = {
      ...output['app.js'],
      fileName: current,
      facadeModuleId: null,
      isEntry: false,
      code: 'exports.value = "current dependency";',
      moduleIds: [dependency],
      modules: { [dependency]: {} },
    } as OutputChunk

    await createGenerateBundleHook(state, false).call({}, {}, output)

    expect(state.hmrSharedChunkImporters.get(current)).toEqual(compiled)
    expect(state.hmrSharedChunksByEntry.get(peer)).toEqual(new Set([peerCompiled ? current : previous]))
    expect(state.hmrSharedChunkImporters.get(previous)).toEqual(peerCompiled ? undefined : new Set([peer]))
    expect(collectAffectedSharedChunkEntriesAndChunks(state, dependency).affectedEntries).toEqual(compiled)
    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([active]))
    expect(state.hmrState.lastEmittedEntryIds).toEqual(compiled)
  })

  it.each(['partial-script', 'metadata-template'] as const)('publishes an executable prelude when a native generation retains its installer through the app input (%s)', async (trigger) => {
    const state = fixture()
    Object.assign(state.ctx.configService.weappViteConfig, {
      injectWeapi: false,
      appPrelude: { webRuntime: { enabled: true, targets: ['AbortController'] } },
    })
    Object.assign(state.ctx.scanService, { appEntry: { path: 'app.ts' } })
    state.ctx.scanService.subPackageMap.set('subpackages/perf', { subPackage: { root: 'subpackages/perf' } } as SubPackageMetaValue)
    state.ctx.scanService.subPackageMap.set('subpackages/standalone', { subPackage: { root: 'subpackages/standalone', independent: true } } as SubPackageMetaValue)
    state.hmrSourceSharedChunks = new Set()
    state.hmrState.hasBuiltOnce = false
    state.hmrState.didEmitAllEntries = true
    state.hmrState.skipSharedChunkRefresh = false
    state.ctx.runtimeState.build.hmr.isRebuild = false
    const runtime = 'weapp-vendors/request-globals-runtime.js'
    const support = 'weapp-vendors/abort-support.js'
    const makeChunk = (fileName: string, code: string, imports: string[] = [], facadeModuleId: string | null = null): OutputChunk => ({
      type: 'chunk',
      fileName,
      code,
      imports,
      dynamicImports: [],
      facadeModuleId,
      isEntry: facadeModuleId !== null,
    } as OutputChunk)
    const initial: OutputBundle = {
      'app.js': makeChunk('app.js', `require('./${runtime}'); exports.ready = new AbortController().signal.aborted === false;`, [runtime], 'app.ts'),
      'pages/active/index.js': makeChunk('pages/active/index.js', 'exports.ready = new AbortController().signal.aborted === false;', [], 'pages/active/index.ts'),
      'components/unrelated.js': makeChunk('components/unrelated.js', 'exports.value = "unchanged-component";', [], 'components/unrelated.ts'),
      'subpackages/perf/pages/inactive/index.js': makeChunk('subpackages/perf/pages/inactive/index.js', `const runtime = require('../../../../${runtime}'); exports.ready = new AbortController().signal.aborted === false;`, [runtime], 'subpackages/perf/pages/inactive/index.ts'),
      [runtime]: makeChunk(runtime, `const support = require('./abort-support.js');
        function installWebRuntimeGlobals(options = {}) {
          const targets = options.targets ?? ${JSON.stringify(FULL_REQUEST_GLOBAL_TARGETS)};
          return { AbortController: support.AbortController };
        }
        Object.defineProperty(exports, 'installWebRuntimeGlobals', { enumerable: true, get: function() { return installWebRuntimeGlobals; } });`, [support]),
      [support]: makeChunk(support, 'exports.AbortController = class AbortController { constructor() { this.signal = { aborted: false }; } };'),
    }
    const generate = createGenerateBundleHook(state, false)
    const publish = async (output: OutputBundle) => {
      const emitted: Record<string, string> = {}
      await generate.call({ emitFile(asset: { type: 'asset', fileName: string, source: string }) {
        emitted[asset.fileName] = asset.source
        output[asset.fileName] = asset as OutputBundle[string]
      } }, {}, output)
      pruneUnchangedDevHmrOutputs(state.ctx, output, undefined, { runtimeRewriteDone: true })
      return emitted
    }
    const firstEmitted = await publish(initial)
    const firstPrelude = firstEmitted['app.prelude.js']
    const subpackagePrelude = firstEmitted['subpackages/perf/app.prelude.js']
    expect(firstPrelude?.trim()).toBeTruthy()
    expect(subpackagePrelude?.trim()).toBeTruthy()
    expect(firstEmitted).not.toHaveProperty('subpackages/standalone/app.prelude.js')
    const component = (initial['components/unrelated.js'] as OutputChunk).code
    const entries = ['app.js', 'pages/active/index.js', 'subpackages/perf/pages/inactive/index.js']
    const expectedRuntime = executePreludePublication(initial, entries)
    expect(expectedRuntime).toEqual(Object.fromEntries(entries.map(file => [file, { ready: true }])))

    let publication = initial
    for (const generation of [2, 3]) {
      state.hmrState.didEmitAllEntries = false
      // 模板实测会复用完整原生 bundle，但没有新的 script emit，不能借用脚本批次的标记。
      state.hmrState.skipSharedChunkRefresh = trigger === 'metadata-template'
      state.hmrState.lastHmrEntryIds = new Set(['pages/active/index.ts'])
      state.hmrState.lastEmittedEntryIds = new Set(trigger === 'metadata-template' ? [] : ['pages/active/index.ts'])
      state.hmrState.affectedSharedChunkIds = new Set(['pages/active/index.js'])
      state.ctx.runtimeState.build.hmr.isRebuild = true
      state.ctx.runtimeState.build.hmr.forceFullSharedChunkRefresh = false
      state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames = new Set(['pages/active/index.js'])
      const output = Object.fromEntries(Object.entries(publication)
        .filter(([, item]) => item.type === 'chunk')
        .map(([file, item]) => [file, { ...item }])) as OutputBundle
      const emitted = await publish(output)
      // 每代必须由当前 native bundle 重新生成有效 prelude，不能靠保留旧磁盘文件掩盖空发布。
      expect(emitted['app.prelude.js'], `generation ${generation} emits its executable prelude`).toBe(firstPrelude)
      expect(emitted['subpackages/perf/app.prelude.js'], `generation ${generation} emits its inactive subpackage prelude`).toBe(subpackagePrelude)
      publication = { ...publication, ...output }
      expect(executePreludePublication(publication, entries)).toEqual(expectedRuntime)
      expect((publication['components/unrelated.js'] as OutputChunk).code).toBe(component)
    }

    Object.assign(state.ctx.configService.weappViteConfig, { appPrelude: { webRuntime: false } })
    state.hmrState.didEmitAllEntries = true
    state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.clear()
    const restarted: OutputBundle = {
      'app.js': makeChunk('app.js', 'exports.ready = "runtime-disabled";', [], 'app.ts'),
      'pages/active/index.js': makeChunk('pages/active/index.js', 'exports.ready = "runtime-disabled";', [], 'pages/active/index.ts'),
    }
    const restartedAssets: string[] = []
    await createGenerateBundleHook(state, false).call({ emitFile(asset: { fileName: string }) {
      restartedAssets.push(asset.fileName)
    } }, {}, restarted)
    expect(restartedAssets).not.toContain('app.prelude.js')
    expect(restartedAssets).not.toContain('subpackages/perf/app.prelude.js')
    expect(restarted[runtime]).toBeUndefined()
    expect(restarted[support]).toBeUndefined()
    expect(state.hmrSharedChunkImporters.has(runtime)).toBe(false)
    expect(executePreludePublication(restarted)).toEqual({
      'app.js': { ready: 'runtime-disabled' },
      'pages/active/index.js': { ready: 'runtime-disabled' },
    })
  })

  it('does not overwrite an independent prelude when its native generation only publishes metadata assets', async () => {
    const state = fixture()
    state.subPackageMeta = { subPackage: { root: 'subpackages/standalone', independent: true } } as SubPackageMetaValue
    Object.assign(state.ctx.configService.weappViteConfig, {
      injectWeapi: false,
      appPrelude: { webRuntime: { enabled: true, targets: ['AbortController'] } },
    })
    const output = bundle()
    const emitted: string[] = []
    await createGenerateBundleHook(state, false).call({ emitFile(asset: { fileName: string }) {
      emitted.push(asset.fileName)
    } }, {}, output)

    expect(Object.values(output).some(item => item.type === 'chunk')).toBe(false)
    expect(output['pages/active/index.wxml']).toBeDefined()
    expect(emitted).not.toContain('subpackages/standalone/app.prelude.js')
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
