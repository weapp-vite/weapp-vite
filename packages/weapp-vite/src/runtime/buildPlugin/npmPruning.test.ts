import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  watchFiles: [],
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
    vi.clearAllMocks()
  })

  it('prunes against the final bundle, emits retained assets, then publishes external outputs', async () => {
    mocks.prepareNpmAssets.mockResolvedValueOnce(output)
    const emitted: unknown[] = []
    const plugin = (await import('./npmPruning')).createNpmPruningPlugin(createPluginContext())
    const generateBundle = plugin.generateBundle as Extract<Plugin['generateBundle'], object>
    const writeBundle = plugin.writeBundle as Extract<Plugin['writeBundle'], object>
    const generateHandler = generateBundle.handler as (this: unknown, options: unknown, bundle: object) => Promise<void>
    const writeHandler = writeBundle.handler as (this: unknown) => Promise<void>
    const bundle = { 'pages/index.js': { type: 'chunk', fileName: 'pages/index.js', code: 'require("card")' } }

    await generateHandler.call({ emitFile: (asset: unknown) => emitted.push(asset) }, {}, bundle)
    expect(mocks.prepareNpmAssets).toHaveBeenCalledOnce()
    expect(mocks.pruneNpmOutput).toHaveBeenCalledWith(output, bundle, {
      enabled: true,
      packageFiles: { card: { include: ['index.js'] } },
    })
    expect(emitted).toEqual(output.assets)

    await writeHandler.call({})
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
    await (writeBundle.handler as (this: unknown) => Promise<void>).call({})
    expect(mocks.publishOwnedNpmAssets).not.toHaveBeenCalled()
  })
})
