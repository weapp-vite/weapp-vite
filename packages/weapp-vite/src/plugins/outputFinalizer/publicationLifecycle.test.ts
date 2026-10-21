import type { EmittedAsset } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputPublicationPlugin } from './publication'

const { prepare, commit, emit, commitPublic } = vi.hoisted(() => {
  const commit = vi.fn(async () => {})
  return {
    prepare: vi.fn(() => commit),
    commit,
    emit: vi.fn(async (_files: Iterable<string>, _partial: boolean, _emitFile: (asset: EmittedAsset) => void) => {}),
    commitPublic: vi.fn(async () => {}),
  }
})

vi.mock('./ownership', () => ({ prepareOutputPublicationOwnership: prepare }))
vi.mock('../asset/publication', () => ({
  createPublicAssetPublication: () => ({ configure() {}, start() {}, emit, commit: commitPublic }),
}))

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

function fixture(subPackageMeta?: SubPackageMetaValue) {
  const root = path.resolve('publication-lifetime-fixture')
  const ctx = { configService: { isDev: true }, runtimeState: createRuntimeState() } as CompilerContext
  const plugin = createOutputPublicationPlugin(ctx, subPackageMeta)
  const hookContext = { meta: { watchMode: false }, warn() {}, addWatchFile() {}, emitFile() {} }
  handler(plugin.configResolved)({ root, build: { outDir: 'dist' } })
  return { ctx, plugin, root, hookContext }
}

describe('output publication lifetime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commit.mockResolvedValue(undefined)
    emit.mockResolvedValue(undefined)
    commitPublic.mockResolvedValue(undefined)
  })

  it('commits a writing output once and leaves generated snapshots without ownership work', async () => {
    const { ctx, plugin, root, hookContext } = fixture()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, false)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).not.toHaveBeenCalled()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare.mock.calls).toEqual([
      [ctx, path.join(root, 'dist'), { outputNames: [], independentOutputNames: [], publicOutputNames: [], partial: false, retireStateful: true }],
    ])
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).toHaveBeenCalledOnce()
    expect(commit).toHaveBeenCalledOnce()
  })

  it.each(['buildStart', 'closeBundle', 'closeWatcher'] as const)('discards abandoned output ownership at %s', async (boundary) => {
    const { plugin, hookContext } = fixture()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin[boundary]).call(hookContext)
    await handler(plugin.writeBundle).call(hookContext)
    expect(commit).not.toHaveBeenCalled()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenCalledOnce()
  })

  it('discards ownership when generation fails after preparing its output names', async () => {
    const { plugin, hookContext } = fixture()
    emit.mockRejectedValueOnce(new Error('public asset failed'))
    await expect(handler(plugin.generateBundle).call(hookContext, {}, {}, true)).rejects.toThrow('public asset failed')
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).not.toHaveBeenCalled()
  })

  it('does not replay a failed ownership commit on a reused plugin', async () => {
    const { plugin, hookContext } = fixture()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    commit.mockRejectedValueOnce(new Error('ownership failed'))
    await expect(handler(plugin.writeBundle).call(hookContext)).rejects.toThrow('ownership failed')
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledOnce()
  })

  it('does not commit ownership after public publication fails', async () => {
    const { plugin, hookContext } = fixture()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    commitPublic.mockRejectedValueOnce(new Error('public commit failed'))
    await expect(handler(plugin.writeBundle).call(hookContext)).rejects.toThrow('public commit failed')
    expect(commit).not.toHaveBeenCalled()
    await handler(plugin.writeBundle).call(hookContext)
    expect(commit).not.toHaveBeenCalled()
  })

  it('protects actual public emissions in the pending publication', async () => {
    const { plugin, hookContext } = fixture()
    emit.mockImplementationOnce(async (_files, _partial, emitFile) => {
      emitFile({ type: 'asset', fileName: 'public-file.txt', source: 'public contents' })
    })
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    expect(prepare).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ publicOutputNames: ['public-file.txt'] }))
    expect(commit).not.toHaveBeenCalled()
    await handler(plugin.writeBundle).call(hookContext)
    expect(commit).toHaveBeenCalledOnce()
  })

  it('keeps partial publications from retiring stateful ownership', async () => {
    const { ctx, plugin, hookContext } = fixture()
    ctx.runtimeState.build.hmr.isRebuild = true
    ctx.runtimeState.build.hmr.didEmitAllEntries = false
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    expect(prepare).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ partial: true, retireStateful: false }))
  })

  it('does not prepare ownership for the bundled stateful engine', async () => {
    const { plugin, root, hookContext } = fixture()
    handler(plugin.configResolved)({ root, build: { outDir: 'dist' }, experimental: { bundledDev: true } })
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
  })

  it('does not let an independent subpackage retire the root stateful publication', async () => {
    const { plugin, hookContext } = fixture({ subPackage: { root: 'independent' } } as SubPackageMetaValue)
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    expect(prepare).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ partial: false, retireStateful: false }))
  })

  it('does not let a plugin target retire the app stateful publication', async () => {
    const { ctx, plugin, hookContext } = fixture()
    ctx.currentBuildTarget = 'plugin'
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    expect(prepare).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ retireStateful: false }))
  })
})
