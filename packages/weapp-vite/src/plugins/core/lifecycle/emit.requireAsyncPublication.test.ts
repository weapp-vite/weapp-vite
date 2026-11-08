import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../helpers'
import { createContext, runInContext } from 'node:vm'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createRequireAnalysisPlugin } from '../requireAnalysis'
import { createRequireAsyncTargetMarker } from '../requireAsyncTarget'
import { createGenerateBundleHook } from './emit/generate'

it('publishes an inactive native async target and its runtime during another page update', async () => {
  vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  const root = path.resolve('native-async-publication-fixture')
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.isRebuild = true
  runtimeState.build.hmr.forceEmitUnchangedChunks = false
  runtimeState.build.hmr.lastEmittedChunkFileNames.add('pages/active.js')
  const state = {
    ctx: {
      currentBuildTarget: 'app',
      runtimeState,
      scanService: { subPackageMap: new Map([['shared', { subPackage: { root: 'shared' } }]]) },
      configService: {
        cwd: root,
        outDir: path.join(root, 'dist'),
        isDev: true,
        platform: 'weapp',
        packageJson: { dependencies: {} },
        weappViteConfig: { hmr: { runtime: 'classic' }, appPrelude: false, injectWeapi: false, chunks: { logOptimization: false } },
        relativeAbsoluteSrcRoot: (id: string) => id,
      },
    },
    resolvedConfig: { root, build: { outDir: 'dist', write: true } },
    entriesMap: new Map(),
    hmrState: {
      hasBuiltOnce: true,
      didEmitAllEntries: false,
      skipSharedChunkRefresh: false,
      lastHmrEntryIds: new Set(['pages/active.ts']),
      lastEmittedEntryIds: new Set(['pages/active.ts']),
    },
    hmrSharedChunksMode: 'auto',
    hmrSourceSharedChunks: new Set(),
    hmrSharedChunkImporters: new Map(),
    hmrSharedChunksByEntry: new Map(),
    hmrSharedChunkDependencies: new Map(),
    outputChunksByModule: new Map(),
    requireAsyncEmittedChunks: new Set(),
  } as unknown as CorePluginState
  const chunk = (fileName: string, code: string, imports: string[] = [], entry = false): OutputChunk => ({
    type: 'chunk',
    fileName,
    code,
    imports,
    dynamicImports: [],
    isEntry: entry,
    facadeModuleId: entry ? fileName.replace('.js', '.ts') : null,
    modules: {},
  } as OutputChunk)
  const output: OutputBundle = {
    'app.js': chunk('app.js', 'exports.ready = true', [], true),
    'pages/active.js': chunk('pages/active.js', `exports.open = () => require.async(${JSON.stringify(createRequireAsyncTargetMarker('shared/lazy.js'))})`, [], true),
    'shared/lazy.js': chunk('shared/lazy.js', 'exports.value = require("./runtime.js").value', ['shared/runtime.js'], true),
    'shared/runtime.js': chunk('shared/runtime.js', 'exports.value = require("./leaf.js").value', ['shared/leaf.js']),
    'shared/leaf.js': chunk('shared/leaf.js', 'exports.value = "native-async-published-value"'),
  }
  try {
    await createGenerateBundleHook(state, false).call({}, {}, output)
    const rewrite = createRequireAnalysisPlugin(state).generateBundle as (options: unknown, bundle: OutputBundle) => void
    rewrite({}, output)
    expect(Object.keys(output).sort()).toEqual(['app.js', 'pages/active.js', 'shared/lazy.js', 'shared/leaf.js', 'shared/runtime.js'])
    const context = createContext({})
    const load = (file: string): Record<string, any> => {
      const target = output[file]
      if (target?.type !== 'chunk') {
        throw new Error(`Missing native async publication module: ${file}`)
      }
      const module = { exports: {} }
      const require = Object.assign((request: string) => load(path.join(path.dirname(file), request)), {
        async: async (request: string) => load(path.join(path.dirname(file), request)),
      })
      runInContext(`(function(module, exports, require) {\n${target.code}\n})`, context)(module, module.exports, require)
      return module.exports
    }
    expect(await load('pages/active.js').open()).toEqual({ value: 'native-async-published-value' })
  }
  finally {
    vi.unstubAllEnvs()
  }
})
