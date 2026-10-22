import type { OutputBundle, OutputChunk } from 'rolldown'
import type { SubPackageMetaValue } from '../../../types'
import type { CorePluginState } from '../helpers'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { SHARED_CHUNK_VIRTUAL_PREFIX, SUB_PACKAGE_SHARED_DIR } from '../../../runtime/chunkStrategy'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { pruneUnchangedDevHmrOutputs } from '../../outputFinalizer/hmrPrune'
import { createGenerateBundleHook } from './emit/generate'

const sharedFile = `${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA_packageB/common.js`

function chunk(fileName: string, code: string, imports: string[] = [], facadeModuleId: string | null = null): OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code,
    imports,
    dynamicImports: [],
    facadeModuleId,
    isEntry: facadeModuleId !== null,
    exports: [],
    modules: {},
    moduleIds: [],
    map: null,
    name: fileName,
    preliminaryFileName: fileName,
    isDynamicEntry: false,
    sourcemapFileName: `${fileName}.map`,
  }
}

function rawBundle(mainImporter: boolean): OutputBundle {
  const output: OutputBundle = {
    'app.js': chunk('app.js', 'App({})', [], 'app.ts'),
    'pages/active/index.js': chunk('pages/active/index.js', 'Page({})', [], 'pages/active/index.ts'),
    'packageA/index.js': chunk('packageA/index.js', `import { sharedValue } from '../${sharedFile}'; Page({ data: { sharedValue } });`, [sharedFile], 'packageA/index.ts'),
    'packageB/index.js': chunk('packageB/index.js', `import { sharedValue } from '../${sharedFile}'; Page({ data: { sharedValue } });`, [sharedFile], 'packageB/index.ts'),
    [sharedFile]: chunk(sharedFile, 'export const sharedValue = "shared-public-value";'),
  }
  if (mainImporter) {
    output['cipher.js'] = chunk('cipher.js', `import { sharedValue } from './${sharedFile}'; export const cipherValue = sharedValue;`, [sharedFile])
  }
  return output
}

function fixture(): CorePluginState {
  const root = path.resolve('classic-shared-publication-fixture')
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.forceEmitUnchangedChunks = false
  return {
    ctx: {
      currentBuildTarget: 'app',
      runtimeState,
      scanService: {
        subPackageMap: new Map(['packageA', 'packageB'].map(root => [root, { subPackage: { root } } as SubPackageMetaValue])),
      },
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
          injectWeapi: false,
          chunks: { sharedStrategy: 'duplicate', logOptimization: false },
        },
        relativeAbsoluteSrcRoot: (id: string) => id,
      },
    },
    resolvedConfig: { root, build: { outDir: 'dist', write: true } },
    entriesMap: new Map(),
    watchFilesSnapshot: [],
    hmrState: {
      hasBuiltOnce: false,
      didEmitAllEntries: true,
      skipSharedChunkRefresh: false,
      lastHmrEntryIds: new Set(),
      lastEmittedEntryIds: new Set(),
      affectedSharedChunkIds: new Set(),
    },
    hmrSharedChunksMode: 'auto',
    hmrSourceSharedChunks: new Set(),
    hmrSharedChunkImporters: new Map(),
    hmrSharedChunksByEntry: new Map(),
    hmrSharedChunkDependencies: new Map(),
    outputChunksByModule: new Map(),
  } as unknown as CorePluginState
}

it.each([true, false])('keeps relocated shared imports closed across metadata updates (main importer: %s)', async (mainImporter) => {
  vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  try {
    const state = fixture()
    const generate = createGenerateBundleHook(state, false)
    const published = new Map<string, string>()
    const publish = async (output: OutputBundle) => {
      await generate.call({ emitFile(asset: { type: 'asset', fileName: string, source: string }) {
        output[asset.fileName] = asset as OutputBundle[string]
        return asset.fileName
      } }, {}, output)
      const coreFileNames = Object.values(output).map(item => item.fileName)
      expect(coreFileNames.some(file => file.startsWith(`${SHARED_CHUNK_VIRTUAL_PREFIX}/`))).toBe(false)
      pruneUnchangedDevHmrOutputs(state.ctx, output, undefined, { runtimeRewriteDone: true })
      for (const item of Object.values(output)) {
        if (item.fileName.endsWith('.js')) {
          published.set(item.fileName, item.type === 'chunk' ? item.code : String(item.source))
        }
      }
      for (const [fileName, code] of published) {
        for (const match of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
          const request = match[1]!
          if (request.startsWith('.')) {
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(fileName), request))
            expect(published.has(target), `${fileName} imports missing ${target}`).toBe(true)
          }
        }
      }
      return { coreFileNames, writtenFileNames: Object.values(output).map(item => item.fileName) }
    }
    await publish(rawBundle(mainImporter))
    const sharedTargets = mainImporter
      ? ['packageA_packageB/common.js']
      : ['packageA', 'packageB'].map(root => `${root}/${SUB_PACKAGE_SHARED_DIR}/common.js`)
    for (const file of sharedTargets) {
      expect(published.get(file)).toContain('shared-public-value')
    }

    state.hmrState.didEmitAllEntries = false
    state.hmrState.skipSharedChunkRefresh = true
    state.hmrState.lastHmrEntryIds = new Set(['pages/active/index.ts'])
    state.ctx.runtimeState.build.hmr.isRebuild = true
    state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames = new Set([
      'pages/active/index.js',
      'cipher.js',
      'packageA/index.js',
      'packageB/index.js',
    ])
    // 原生增量重新提供原始 bundle；共享目标未动态发射，旧发布只拥有搬迁后的文件。
    for (let generation = 2; generation <= 3; generation++) {
      const { coreFileNames, writtenFileNames } = await publish(rawBundle(mainImporter))
      for (const file of sharedTargets) {
        expect(writtenFileNames, `generation ${generation} rewrites unchanged shared target`).not.toContain(file)
        if (mainImporter) {
          expect(coreFileNames, `generation ${generation} retains unplanned shared target`).not.toContain(file)
        }
      }
    }
  }
  finally {
    vi.unstubAllEnvs()
  }
})

it('refreshes compiler entry dependencies independently of the smaller HMR owner set', async () => {
  vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  try {
    const state = fixture()
    state.ctx.scanService.subPackageMap.clear()
    const active = 'pages/active/index.ts'
    const retained = 'pages/retained/index.ts'
    state.resolvedEntryMap = new Map([active, retained].map(id => [id, { id }]))
    const makeBundle = (dependency: string): OutputBundle => ({
      'app.js': chunk('app.js', 'App({})', [], 'app.ts'),
      'pages/active/index.js': chunk('pages/active/index.js', 'Page({})', [], active),
      'pages/retained/index.js': chunk('pages/retained/index.js', `const runtime = require('../../${dependency}'); Page({ data: { value: runtime.value } });`, [dependency], retained),
      [dependency]: chunk(dependency, 'exports.value = "retained-shared-value";'),
    })
    const generate = createGenerateBundleHook(state, false)
    await generate.call({}, {}, makeBundle('previous-shared.js'))
    expect(state.hmrSharedChunkImporters.get('previous-shared.js')).toEqual(new Set([retained]))

    state.hmrState.didEmitAllEntries = false
    state.hmrState.lastHmrEntryIds = new Set([active])
    state.hmrState.lastEmittedEntryIds = new Set([active, retained])
    state.ctx.runtimeState.build.hmr.isRebuild = true
    state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames = new Set(['pages/active/index.js', 'pages/retained/index.js'])
    const output = makeBundle('current-shared.js')

    await generate.call({}, {}, output)

    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([active]))
    expect(state.hmrSharedChunkImporters.has('previous-shared.js')).toBe(false)
    expect(state.hmrSharedChunkImporters.get('current-shared.js')).toEqual(new Set([retained]))
    expect(state.hmrSharedChunksByEntry.get(retained)).toEqual(new Set(['current-shared.js']))
    expect(output['current-shared.js']).toBeDefined()
    expect(state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('current-shared.js')).toBe(true)
  }
  finally {
    vi.unstubAllEnvs()
  }
})
