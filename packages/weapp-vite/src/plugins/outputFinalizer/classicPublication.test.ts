import type { EmittedAsset, OutputBundle, OutputChunk, RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { pruneUneventedDevHmrChunks } from './hmrPrune'
import { createOutputPublicationPlugin } from './publication'

const { prepare, commit, validate, publicStart, publicCommit, publicFiles } = vi.hoisted(() => {
  const commit = vi.fn(async () => {})
  return {
    prepare: vi.fn(() => commit),
    commit,
    validate: vi.fn(async () => undefined),
    publicStart: vi.fn((_root: string) => {}),
    publicCommit: vi.fn(async (_root: string) => {}),
    publicFiles: new Map<string, EmittedAsset[]>(),
  }
})

vi.mock('./ownership', () => ({ prepareOutputPublicationOwnership: prepare }))
vi.mock('../../wxml/validate', () => ({ validateWxmlBundle: validate }))
vi.mock('../asset/publication', () => ({
  createPublicAssetPublication: () => {
    let config: { root: string, build: { outDir: string, copyPublicDir?: boolean }, experimental?: { bundledDev?: boolean } }
    let enabled: boolean
    return {
      configure(value: typeof config) {
        config = value
        enabled = value.build.copyPublicDir !== false && value.experimental?.bundledDev !== true
      },
      start() {
        publicStart(path.resolve(config.root, config.build.outDir))
        if (enabled) {
          config.build.copyPublicDir = false
        }
      },
      async emit(_names: unknown, _partial: boolean, emitFile: (asset: EmittedAsset) => void) {
        if (enabled) {
          for (const asset of publicFiles.get(path.resolve(config.root, config.build.outDir)) ?? []) {
            emitFile(asset)
          }
        }
      },
      async commit() { await publicCommit(path.resolve(config.root, config.build.outDir)) },
    }
  },
}))

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

function bundle(value = 'original') {
  return {
    'app.js': { type: 'chunk', fileName: 'app.js', isEntry: true, code: 'App({})' },
    'pages/home/index.js': { type: 'chunk', fileName: 'pages/home/index.js', isEntry: true, code: `Page({ value: ${JSON.stringify(value)} })` },
    'pages/home/index.wxml': { type: 'asset', fileName: 'pages/home/index.wxml', source: `<view>${value}</view>` },
  } as OutputBundle
}

function fixture(options: { config?: Record<string, unknown>, subPackageMeta?: SubPackageMetaValue } = {}) {
  const root = path.resolve('classic-publication-fixture')
  const outDir = path.join(root, 'dist')
  const ctx = {
    currentBuildTarget: 'app',
    configService: {
      isDev: true,
      platform: 'weapp',
      weappViteConfig: { hmr: { runtime: 'classic' } },
      projectPrivateConfig: { setting: { compileHotReLoad: true } },
    },
    scanService: { independentSubPackageMap: new Map([['pkg', {}]]) },
    runtimeState: createRuntimeState(),
  } as CompilerContext
  const plugin = createOutputPublicationPlugin(ctx, options.subPackageMeta)
  const emitted: EmittedAsset[] = []
  const hookContext = {
    meta: { watchMode: false },
    warn() {},
    addWatchFile() {},
    emitFile(asset: EmittedAsset) {
      emitted.push(asset)
    },
  }
  const configure = (config: Record<string, unknown> = {}) => handler(plugin.configResolved)({ root, build: { outDir: 'dist', write: true, copyPublicDir: true }, ...config })
  configure(options.config)
  handler(plugin.buildStart).call(hookContext)
  const generate = async (output: OutputBundle, outputOptions = {}, isWrite = true) => {
    await handler(plugin.generateBundle).call(hookContext, outputOptions, output, isWrite)
    return output
  }
  const write = (outputOptions = {}) => handler(plugin.writeBundle).call(hookContext, outputOptions)
  const rebuild = () => {
    const hmr = ctx.runtimeState.build.hmr
    hmr.isRebuild = true
    hmr.didEmitAllEntries = false
    hmr.forceEmitUnchangedChunks = false
    hmr.lastEmittedChunkFileNames.add('pages/home/index.js')
  }
  const generation = (dir = outDir) => getHmrRuntimeSession(ctx).outputGenerations.get(dir)
  return { ctx, plugin, hookContext, root, outDir, emitted, generate, write, rebuild, generation, configure }
}

describe('classic native publication transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commit.mockResolvedValue(undefined)
    publicCommit.mockResolvedValue(undefined)
    validate.mockResolvedValue(undefined)
    publicFiles.clear()
  })

  it('retains the native root before final content pruning and suppresses unchanged generations', async () => {
    const run = fixture()
    await run.generate(bundle())
    expect(run.ctx.runtimeState.build.output.emittedSource.size).toBe(0)
    expect(run.generation()).toBeUndefined()
    await run.write()
    const first = run.generation()
    run.rebuild()
    const output = bundle()
    pruneUneventedDevHmrChunks(run.ctx, output)
    expect(output['app.js']).toBeDefined()
    await run.generate(output)
    expect(output['app.js']).toBeUndefined()
    expect(Object.keys(output)).toEqual([])
    await run.write()
    expect(run.generation()?.fingerprint).toBe(first?.fingerprint)
  })

  it('publishes only the changed metadata and native reload signal after final content pruning', async () => {
    const run = fixture()
    await run.generate(bundle())
    await run.write()
    const previousGeneration = run.generation()
    run.rebuild()
    const output = bundle()
    output['pages/home/index.wxml'] = { type: 'asset', fileName: 'pages/home/index.wxml', source: '<view>updated template</view>' }
    await run.generate(output)
    expect(Object.keys(output).sort()).toEqual(['app.js', 'pages/home/index.wxml'])
    expect(run.generation()).toBe(previousGeneration)
    await run.write()
    expect(run.generation()?.fingerprint).not.toBe(previousGeneration?.fingerprint)
    expect(run.ctx.runtimeState.build.output.emittedSource.get('pages/home/index.js')).toBe((bundle()['pages/home/index.js'] as OutputChunk).code)
    expect(run.ctx.runtimeState.build.output.emittedSource.get('pages/home/index.wxml')).toBe('<view>updated template</view>')
  })

  it.each(['abandoned native write', 'ownership failure', 'public failure'])('replays all pruned bytes after %s', async (failure) => {
    const run = fixture()
    await run.generate(bundle())
    await run.write()
    const previous = new Map(run.ctx.runtimeState.build.output.emittedSource)
    const previousGeneration = run.generation()
    run.rebuild()
    const failed = await run.generate(bundle('updated'))
    expect(Object.keys(failed).sort()).toEqual(['app.js', 'pages/home/index.js', 'pages/home/index.wxml'])
    if (failure === 'abandoned native write') {
      await handler(run.plugin.buildStart).call(run.hookContext)
    }
    else {
      if (failure === 'ownership failure') {
        commit.mockRejectedValueOnce(new Error('ownership failed'))
      }
      else {
        publicCommit.mockRejectedValueOnce(new Error('public failed'))
      }
      await expect(run.write()).rejects.toThrow('failed')
    }
    expect(run.ctx.runtimeState.build.output.emittedSource).toEqual(previous)
    expect(run.generation()).toBe(previousGeneration)
    const retried = await run.generate(bundle('updated'))
    expect(Object.keys(retried).sort()).toEqual(Object.keys(failed).sort())
    await run.write()
    expect(run.generation()?.fingerprint).not.toBe(previousGeneration?.fingerprint)
    expect(run.ctx.runtimeState.build.output.emittedSource.get('app.js')).toBe((retried['app.js'] as OutputChunk).code)
  })

  it('includes public and captured independent bytes before the asynchronous flush', async () => {
    const run = fixture()
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'icon.bin', source: new Uint8Array([1, 2]) }])
    const child: RolldownOutput = { output: [{ type: 'asset', fileName: 'pkg/page.wxml', source: '<view>child</view>', names: [], originalFileNames: [] }] }
    run.ctx.runtimeState.build.independent.outputs.set('pkg', child)
    validate.mockImplementationOnce(async () => {
      run.ctx.runtimeState.build.independent.outputs.delete('pkg')
      return undefined
    })
    await run.generate(bundle())
    await run.write()
    expect(run.generation()?.scopes.get('independent')?.has('pkg/page.wxml')).toBe(true)
    expect(run.generation()?.scopes.get('public')?.has('icon.bin')).toBe(true)
    const first = run.generation()?.fingerprint
    run.rebuild()
    run.ctx.runtimeState.build.independent.outputs.set('pkg', child)
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'icon.bin', source: new Uint8Array([1, 3]) }])
    const changed = await run.generate(bundle())
    expect(changed['app.js']).toBeDefined()
    await run.write()
    expect(run.generation()?.fingerprint).not.toBe(first)
  })

  it('keeps output directories and their public policy independent when writes interleave', async () => {
    const run = fixture()
    const other = path.join(run.root, 'other-dist')
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'icon.bin', source: 'first' }])
    publicFiles.set(other, [{ type: 'asset', fileName: 'icon.bin', source: 'second' }])
    await run.generate(bundle())
    await run.generate(bundle(), { dir: other })
    await run.write({ dir: other })
    expect(run.generation()).toBeUndefined()
    expect(run.generation(other)?.scopes.get('public')?.has('icon.bin')).toBe(true)
    await run.write()
    expect(run.generation()?.scopes.get('public')?.has('icon.bin')).toBe(true)
    expect(run.generation()?.fingerprint).not.toBe(run.generation(other)?.fingerprint)
    expect(publicCommit.mock.calls.map(([dir]) => dir)).toEqual([other, run.outDir])
  })

  it('caches the final native source map bytes after the marker rewrite and successful write', async () => {
    const run = fixture()
    const mappedBundle = () => {
      const output = bundle()
      const app = output['app.js'] as OutputChunk
      app.map = { version: 3, names: [], sources: ['app.ts'], sourcesContent: ['App({})'], mappings: 'AAAA' } as OutputChunk['map']
      app.sourcemapFileName = 'app.js.map'
      output['app.js.map'] = { type: 'asset', fileName: 'app.js.map', source: 'stale map' } as OutputBundle[string]
      return output
    }
    const output = await run.generate(mappedBundle())
    const app = output['app.js'] as OutputChunk
    const sourceMap = output['app.js.map']
    expect(sourceMap).toMatchObject({ type: 'asset', source: JSON.stringify(app.map) })
    expect(run.ctx.runtimeState.build.output.emittedSource.has('app.js.map')).toBe(false)
    await run.write()
    expect(run.ctx.runtimeState.build.output.emittedSource.get('app.js.map')).toBe(JSON.stringify(app.map))
    run.rebuild()
    expect(Object.keys(await run.generate(mappedBundle()))).toEqual([])
  })

  it('reconfigures only active output scopes without scanning historical directories or reusing their byte cache', async () => {
    const run = fixture()
    const other = path.join(run.root, 'other-dist')
    const next = path.join(run.root, 'next-dist')
    await run.generate(bundle())
    await run.write()
    await run.generate(bundle(), { dir: other })
    await run.write({ dir: other })
    const previous = run.generation()
    const previousOther = run.generation(other)
    publicStart.mockClear()
    run.configure({ build: { outDir: 'next-dist', write: true, copyPublicDir: true } })
    expect(publicStart).not.toHaveBeenCalled()
    expect(run.ctx.runtimeState.build.output.emittedSource.size).toBe(0)
    handler(run.plugin.buildStart).call(run.hookContext)
    expect(publicStart.mock.calls.map(([dir]) => dir)).toEqual([next])
    run.rebuild()
    const output = await run.generate(bundle())
    expect(Object.keys(output).sort()).toEqual(['app.js', 'pages/home/index.js', 'pages/home/index.wxml'])
    await run.write()
    expect(run.generation(next)).toBeDefined()
    expect(run.generation()).toBe(previous)
    expect(run.generation(other)).toBe(previousOther)
  })

  it('refreshes the public policy when a reused scope switches to bundled development', async () => {
    const run = fixture()
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'public.txt', source: 'original public' }])
    await run.generate(bundle())
    await run.write()
    const previousGeneration = run.generation()
    run.rebuild()
    const build = { outDir: 'dist', write: true, copyPublicDir: true }
    run.configure({ build, experimental: { bundledDev: true } })
    handler(run.plugin.buildStart).call(run.hookContext)
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'public.txt', source: 'replacement public' }])
    await run.generate(bundle())
    expect(run.ctx.runtimeState.build.output.emittedSource.get('app.js')).toBe('App({})')
    expect(run.emitted).not.toContainEqual({ type: 'asset', fileName: 'public.txt', source: 'replacement public' })
    expect(build.copyPublicDir).toBe(true)
    run.configure()
    expect(run.ctx.runtimeState.build.output.emittedSource.size).toBe(0)
    expect(run.generation()).toBe(previousGeneration)
    handler(run.plugin.buildStart).call(run.hookContext)
    const resumed = await run.generate(bundle())
    expect(Object.keys(resumed).sort()).toEqual(['app.js', 'pages/home/index.js', 'pages/home/index.wxml'])
    expect(run.emitted).toContainEqual({ type: 'asset', fileName: 'public.txt', source: 'replacement public' })
    await run.write()
    expect(run.generation()?.fingerprint).not.toBe(previousGeneration?.fingerprint)
    expect(run.ctx.runtimeState.build.output.emittedSource.get('app.js')).toBe((resumed['app.js'] as OutputChunk).code)
  })

  it.each(['public', 'ownership'])('waits for an active %s commit before close returns', async (boundary) => {
    const run = fixture()
    await run.generate(bundle())
    const gate = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    const block = async () => {
      entered.resolve()
      await gate.promise
    }
    if (boundary === 'public') {
      publicCommit.mockImplementationOnce(block)
    }
    else {
      commit.mockImplementationOnce(block)
    }
    const writing = run.write()
    await entered.promise
    let closed = false
    const closing = handler(run.plugin.closeBundle).call(run.hookContext).then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)
    gate.resolve()
    await writing
    await closing
    expect(run.generation()).toBeDefined()
    expect(run.ctx.runtimeState.build.output.emittedSource.has('app.js')).toBe(true)
    await handler(run.plugin.closeWatcher).call(run.hookContext)
  })

  it('keeps a configured public scope across snapshot closeBundle without reconfiguring the mutated bundler policy', async () => {
    const run = fixture()
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'public.txt', source: 'original public' }])
    await run.generate(bundle())
    await run.write()
    await handler(run.plugin.closeBundle).call(run.hookContext)
    await handler(run.plugin.closeBundle).call(run.hookContext)
    handler(run.plugin.buildStart).call(run.hookContext)
    run.rebuild()
    publicFiles.set(run.outDir, [{ type: 'asset', fileName: 'public.txt', source: 'updated public' }])
    await run.generate(bundle())
    await run.write()
    expect(run.emitted).toContainEqual({ type: 'asset', fileName: 'public.txt', source: 'updated public' })
    expect(run.generation()?.scopes.get('public')?.has('public.txt')).toBe(true)
  })

  it('stops a retired generation after its asynchronous validation without emitting assets', async () => {
    const run = fixture()
    const validation = Promise.withResolvers<undefined>()
    validate.mockImplementationOnce(() => validation.promise)
    const generating = run.generate(bundle())
    await handler(run.plugin.closeWatcher).call(run.hookContext)
    validation.resolve(undefined)
    await expect(generating).rejects.toThrow('原生发布会话已关闭')
    await run.write()
    expect(run.emitted).toEqual([])
    expect(run.generation()).toBeUndefined()
  })

  it.each([
    { config: { experimental: { bundledDev: true } } },
    { config: { build: { outDir: 'dist', write: false } } },
    { subPackageMeta: { subPackage: { root: 'pkg' } } as SubPackageMetaValue },
  ])('does not install classic publication for stateful, generated snapshots or child outputs (%j)', async (options) => {
    const run = fixture(options)
    const output = await run.generate(bundle())
    expect((output['app.js'] as OutputChunk).code).toBe('App({})')
    await run.write()
    expect(run.generation()).toBeUndefined()
  })
})
