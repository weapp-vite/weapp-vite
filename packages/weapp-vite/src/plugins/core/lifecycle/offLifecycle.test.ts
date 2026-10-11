import type { OutputBundle, OutputChunk } from 'rolldown'
import type { CorePluginState } from '../helpers'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import { createContext, runInContext } from 'node:vm'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createOutputPublicationPlugin } from '../../outputFinalizer/publication'
import { createGenerateBundleHook } from './emit'
import { createBuildEndHook } from './end'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function chunk(fileName: string, code: string, sourceId?: string, imports: string[] = []): OutputChunk {
  return {
    type: 'chunk',
    fileName,
    name: fileName,
    code,
    imports,
    dynamicImports: [],
    exports: ['value'],
    facadeModuleId: sourceId ? createLogicalEntryId(sourceId, fileName === 'app.js' ? 'app' : 'page') : null,
    isEntry: Boolean(sourceId),
    isDynamicEntry: false,
    moduleIds: sourceId ? [sourceId] : [],
    modules: {},
    map: null,
  } as OutputChunk
}

function readPublishedValue(published: Map<string, string>, entry: string) {
  const context = createContext({ wpi: { getStorageSync: (key: string) => `stored:${key}` } })
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const load = (fileName: string): Record<string, unknown> => {
    const existing = modules.get(fileName)
    if (existing) {
      return existing.exports
    }
    const code = published.get(fileName)
    if (code === undefined) {
      throw new Error(`Missing published module: ${fileName}`)
    }
    const module = { exports: {} }
    modules.set(fileName, module)
    runInContext(`(function(module, exports, require) {\n${code}\n})`, context)(
      module,
      module.exports,
      (request: string) => load(path.posix.join(path.posix.dirname(fileName), request)),
    )
    return module.exports
  }
  return load(entry).value
}

async function fixture() {
  const root = path.normalize(await mkdtemp(path.join(os.tmpdir(), 'weapp-off-lifecycle-')))
  temporaryRoots.push(root)
  const sourceRoot = path.join(root, 'src')
  const sources = {
    app: path.join(sourceRoot, 'app.ts'),
    pageA: path.join(sourceRoot, 'pages/a/index.ts'),
    pageB: path.join(sourceRoot, 'pages/b/index.ts'),
  }
  const runtimeState = createRuntimeState()
  const moduleGraphService = createModuleGraphService()
  const graph = new Map<string, { importers: string[], isEntry: boolean }>()
  for (const [name, source] of Object.entries(sources)) {
    const logicalId = createLogicalEntryId(source, name === 'app' ? 'app' : 'page')
    graph.set(source, { importers: [logicalId], isEntry: false })
    graph.set(logicalId, { importers: [], isEntry: true })
  }
  const state = {
    ctx: {
      configService: {
        cwd: root,
        absoluteSrcRoot: sourceRoot,
        outDir: path.join(root, 'dist'),
        isDev: true,
        platform: 'weapp',
        packageJson: { dependencies: {} },
        weappViteConfig: {
          hmr: { sharedChunks: 'off' },
          chunks: { logOptimization: false },
          injectWeapi: { enabled: true, replaceWx: true },
        },
        relativeAbsoluteSrcRoot: (id: string) => path.relative(sourceRoot, id),
      },
      scanService: { subPackageMap: new Map(), independentSubPackageMap: new Map() },
      moduleGraphService,
      runtimeState,
    },
    buildTarget: 'app',
    entriesMap: new Map([
      ['app', { path: sources.app, type: 'app' }],
      ['pages/a/index', { path: sources.pageA, type: 'page' }],
      ['pages/b/index', { path: sources.pageB, type: 'page' }],
    ]),
    resolvedEntryMap: new Map(Object.values(sources).map(id => [id, { id }])),
    loadedEntrySet: new Set(Object.values(sources)),
    hmrRootInputIds: new Set(Object.values(sources)),
    hmrState: {
      hasBuiltOnce: false,
      didEmitAllEntries: true,
      skipSharedChunkRefresh: false,
      affectedSharedChunkIds: new Set(),
      lastEmittedEntryIds: new Set(Object.values(sources)),
    },
    hmrSharedChunksMode: 'off',
    hmrSharedChunkImporters: new Map(),
    hmrSharedChunksByEntry: new Map(),
    hmrSharedChunkDependencies: new Map(),
    outputChunksByModule: new Map(),
    hmrSourceSharedChunks: new Set(),
    watchFilesSnapshot: [],
  } as unknown as CorePluginState
  const buildEnd = createBuildEndHook(state)
  const generate = createGenerateBundleHook(state, false)
  const publication = createOutputPublicationPlugin(state.ctx)
  const publicationHook = publication.generateBundle!
  const publish = typeof publicationHook === 'function' ? publicationHook : publicationHook.handler
  const published = new Map<string, string>()

  function createBundle(pageCode = 'exports.value = "initial";', dependencies: OutputBundle = {}): OutputBundle {
    return {
      'app.js': chunk('app.js', 'exports.value = "app";', sources.app),
      'pages/a/index.js': chunk('pages/a/index.js', pageCode, sources.pageA, Object.keys(dependencies).slice(0, 1)),
      'pages/b/index.js': chunk('pages/b/index.js', 'exports.value = "retained";', sources.pageB),
      ...dependencies,
    }
  }

  async function build(bundle: OutputBundle, changed = false) {
    const pluginContext = {
      meta: { watchMode: false },
      getModuleIds: () => graph.keys(),
      getModuleInfo: (id: string) => graph.get(id),
      warn(message: string) { throw new Error(message) },
      addWatchFile() {},
      emitFile(asset: { fileName?: string, type: string, source?: string }) {
        if (asset.type !== 'asset' || !asset.fileName || asset.source === undefined) {
          throw new Error('Expected a named asset from the publication hooks')
        }
        bundle[asset.fileName] = { ...asset, fileName: asset.fileName } as OutputBundle[string]
        return asset.fileName
      },
    }
    // 发射计划来自上游入口选择；首轮/重建状态完全由真实 hook 生命周期推进。
    state.hmrState.didEmitAllEntries = !changed
    state.hmrState.lastEmittedEntryIds = new Set(changed ? [sources.pageA] : Object.values(sources))
    runtimeState.build.hmr.didEmitAllEntries = !changed
    runtimeState.build.hmr.lastEmittedChunkFileNames = new Set(changed ? ['pages/a/index.js'] : Object.keys(bundle))
    if (changed) {
      moduleGraphService.recordChangedFile(sources.pageA, 'update')
    }
    await buildEnd.call(pluginContext)
    await generate.call(pluginContext, {}, bundle)
    await publish.call(pluginContext as never, {} as never, bundle, false)
    for (const output of Object.values(bundle)) {
      if (output.type === 'chunk') {
        published.set(output.fileName, output.code)
      }
    }
    return Object.keys(bundle)
  }

  return { build, createBundle, published }
}

describe('sharedChunks off publication lifecycle', () => {
  it('publishes only the changed page after the initial build', async () => {
    const { build, createBundle, published } = await fixture()
    expect(await build(createBundle())).toEqual(expect.arrayContaining(['app.js', 'pages/a/index.js', 'pages/b/index.js']))
    expect(readPublishedValue(published, 'pages/a/index.js')).toBe('initial')

    const second = await build(createBundle('exports.value = "updated";'), true)

    expect(second).toContain('pages/a/index.js')
    expect(second).not.toContain('pages/b/index.js')
    expect(second).not.toContain('app.js')
    expect(readPublishedValue(published, 'pages/a/index.js')).toBe('updated')
    expect(readPublishedValue(published, 'pages/b/index.js')).toBe('retained')
  })

  it('retains new shared chunks and their transitive imports without an existing shared graph', async () => {
    const { build, createBundle, published } = await fixture()
    await build(createBundle())
    const second = await build(createBundle(
      'exports.value = require("../../shared-new.js").value;',
      {
        'shared-new.js': chunk('shared-new.js', 'exports.value = require("./shared-leaf.js").value;', undefined, ['shared-leaf.js']),
        'shared-leaf.js': chunk('shared-leaf.js', 'exports.value = wx.getStorageSync("new dependency");'),
      },
    ), true)

    expect(second).toEqual(expect.arrayContaining(['pages/a/index.js', 'shared-new.js', 'shared-leaf.js']))
    expect(readPublishedValue(published, 'pages/a/index.js')).toBe('stored:new dependency')
    expect(readPublishedValue(published, 'pages/b/index.js')).toBe('retained')
    expect(second).not.toContain('pages/b/index.js')
  })
})
