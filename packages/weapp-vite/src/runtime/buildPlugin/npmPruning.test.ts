import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { PreparedNpmOutput } from '../../vite/npm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureNpmPublication } from './npmPublication'

const mocks = vi.hoisted(() => ({
  prepareNpmAssets: vi.fn(),
  pruneNpmOutput: vi.fn(),
  publishOwnedNpmAssets: vi.fn(),
}))

vi.mock('../../vite/npm', () => ({ prepareNpmAssets: mocks.prepareNpmAssets }))
vi.mock('../../vite/npm/prune', () => ({ pruneNpmOutput: mocks.pruneNpmOutput }))
vi.mock('../../vite/npm/ownership', () => ({ publishOwnedNpmAssets: mocks.publishOwnedNpmAssets }))

const output = {
  assets: [{ type: 'asset', fileName: 'miniprogram_npm/card/index.js', source: 'Component({})' }],
  external: new Map(),
  watchFiles: ['node_modules/card/package.json'],
}

function createPluginContext(independentOutputs = new Map()) {
  return {
    runtimeState: { build: { independent: { outputs: independentOutputs } } },
    configService: {
      cwd: '/project',
      outDir: '/project/dist',
      weappViteConfig: { npm: { enable: true, pruneUnusedFiles: true, packageFiles: { card: { include: ['index.js'] } } } },
    },
  } as unknown as CompilerContext
}

describe('production npm pruning plugin', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('prunes against the final bundle, emits retained assets, then publishes external outputs', async () => {
    mocks.prepareNpmAssets.mockResolvedValueOnce(output)
    const emitted: unknown[] = []
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(createPluginContext())
    const generateBundle = plugin.generateBundle as Extract<Plugin['generateBundle'], object>
    const writeBundle = plugin.writeBundle as Extract<Plugin['writeBundle'], object>
    const generateHandler = generateBundle.handler as (this: unknown, options: unknown, bundle: object) => Promise<void>
    const writeHandler = writeBundle.handler as (this: unknown, options: unknown) => Promise<void>
    const bundle = { 'pages/index.js': { type: 'chunk', fileName: 'pages/index.js', code: 'require("card")' } }

    const addWatchFile = vi.fn()
    await (plugin.buildStart as { handler: (this: unknown) => Promise<void> }).handler.call({ addWatchFile })
    expect(addWatchFile).toHaveBeenCalledWith(output.watchFiles[0])
    expect(emitted).toEqual([])
    await generateHandler.call({ emitFile: (asset: unknown) => emitted.push(asset) }, {}, bundle)
    expect(mocks.prepareNpmAssets).toHaveBeenCalledOnce()
    expect(mocks.pruneNpmOutput).toHaveBeenCalledWith(output, bundle, {
      enabled: true,
      packageFiles: { card: { include: ['index.js'] } },
    })
    expect(emitted).toEqual(output.assets)

    await writeHandler.call({}, {})
    expect(mocks.publishOwnedNpmAssets).toHaveBeenCalledWith('/project', '/project/dist', output.external)
  })

  it('includes completed independent package bundles in the pruning graph', async () => {
    mocks.prepareNpmAssets.mockResolvedValueOnce(output)
    const independentOutputs = new Map([
      ['subpackages/independent', {
        output: [{
          type: 'asset',
          fileName: 'subpackages/independent/index.json',
          source: JSON.stringify({ usingComponents: { button: 'ui/button' } }),
        }],
      }],
    ])
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(createPluginContext(independentOutputs))
    const generateBundle = plugin.generateBundle as Extract<Plugin['generateBundle'], object>
    const generateHandler = generateBundle.handler as (this: unknown, options: unknown, bundle: object) => Promise<void>
    const bundle = { 'pages/index.js': { type: 'chunk', fileName: 'pages/index.js', code: 'require("card")' } }

    await generateHandler.call({ emitFile: () => {} }, {}, bundle)

    expect(mocks.pruneNpmOutput).toHaveBeenCalledWith(output, {
      ...bundle,
      'subpackages/independent/index.json': independentOutputs.get('subpackages/independent')!.output[0],
    }, {
      enabled: true,
      packageFiles: { card: { include: ['index.js'] } },
    })
  })

  it('does not publish external outputs when generation did not run', async () => {
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(createPluginContext())
    const writeBundle = plugin.writeBundle as Extract<Plugin['writeBundle'], object>
    await (writeBundle.handler as (this: unknown, options: unknown) => Promise<void>).call({}, {})
    expect(mocks.publishOwnedNpmAssets).not.toHaveBeenCalled()
  })

  it.each(['disabled', 'skipped'])('does not prepare or emit %s npm and resets skipNpm for the next build', async (reason) => {
    const ctx = createPluginContext()
    ctx.configService.weappViteConfig.npm!.enable = reason !== 'disabled'
    configureNpmPublication(ctx, { skipNpm: reason === 'skipped' })
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(ctx)
    const start = (plugin.buildStart as { handler: (this: unknown) => Promise<void> }).handler
    const generate = (plugin.generateBundle as { handler: (this: unknown, options: object, bundle: object) => Promise<void> }).handler
    const emitFile = vi.fn()
    await start.call({ addWatchFile: vi.fn() })
    await generate.call({ emitFile }, {}, {})
    expect(mocks.prepareNpmAssets).not.toHaveBeenCalled()
    expect(emitFile).not.toHaveBeenCalled()

    ctx.configService.weappViteConfig.npm!.enable = true
    configureNpmPublication(ctx, {})
    mocks.prepareNpmAssets.mockResolvedValueOnce(output)
    await start.call({ addWatchFile: vi.fn() })
    await generate.call({ emitFile }, {}, {})
    expect(mocks.prepareNpmAssets).toHaveBeenCalledOnce()
    expect(emitFile).toHaveBeenCalledWith(output.assets[0])
  })

  it('isolates pruning and external publication for multiple output directories', async () => {
    const assets = [output.assets[0]!, { ...output.assets[0]!, fileName: 'miniprogram_npm/card/other.js' }]
    const prepared = { assets, external: new Map([['/external', [...assets]]]), watchFiles: [] }
    mocks.prepareNpmAssets.mockResolvedValueOnce(prepared)
    mocks.pruneNpmOutput.mockImplementation((result: PreparedNpmOutput, bundle: object) => {
      const index = 'first' in bundle ? 0 : 1
      result.assets.splice(index, 1)
      result.external.get('/external')!.splice(index, 1)
    })
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(createPluginContext())
    const generate = (plugin.generateBundle as { handler: (this: unknown, options: object, bundle: object) => Promise<void> }).handler
    const write = (plugin.writeBundle as { handler: (options: object) => Promise<void> }).handler
    const first = vi.fn()
    const second = vi.fn()
    await generate.call({ emitFile: first }, { dir: '/project/first' }, { first: {} })
    await generate.call({ emitFile: second }, { dir: '/project/second' }, {})
    await write({ dir: '/project/second' })
    await write({ dir: '/project/first' })
    expect(first).toHaveBeenCalledWith(assets[1])
    expect(second).toHaveBeenCalledWith(assets[0])
    expect(mocks.publishOwnedNpmAssets).toHaveBeenNthCalledWith(1, '/project', '/project/second', new Map([['/external', [assets[0]]]]))
    expect(mocks.publishOwnedNpmAssets).toHaveBeenNthCalledWith(2, '/project', '/project/first', new Map([['/external', [assets[1]]]]))
    expect(prepared.assets).toHaveLength(2)
    expect(prepared.external.get('/external')).toHaveLength(2)
  })

  it.each(['close', 'error', 'restart'])('releases prepared publication state after %s', async (stage) => {
    mocks.prepareNpmAssets.mockResolvedValue(output)
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(createPluginContext())
    const generate = (plugin.generateBundle as { handler: (this: unknown, options: object, bundle: object) => Promise<void> }).handler
    const write = (plugin.writeBundle as { handler: (options: object) => Promise<void> }).handler
    await generate.call({ emitFile: vi.fn() }, {}, {})
    if (stage === 'close') {
      ;(plugin.closeBundle as { handler: () => void }).handler()
    }
    else if (stage === 'error') {
      ;(plugin.buildEnd as (error: Error) => void)(new Error('build failed'))
    }
    else {
      await (plugin.buildStart as { handler: (this: unknown) => Promise<void> }).handler.call({ addWatchFile: vi.fn() })
    }
    await write({})
    expect(mocks.publishOwnedNpmAssets).not.toHaveBeenCalled()
    await generate.call({ emitFile: vi.fn() }, {}, {})
    expect(mocks.prepareNpmAssets).toHaveBeenCalledTimes(2)
  })
})
