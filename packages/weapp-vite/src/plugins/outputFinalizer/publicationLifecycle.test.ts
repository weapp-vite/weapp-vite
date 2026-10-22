import type { EmittedAsset, OutputBundle } from 'rolldown'
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

  it.each(['buildStart', 'buildEnd', 'renderError', 'configResolved', 'closeBundle', 'closeWatcher'] as const)('invalidates a pending read-only publication at the real %s hook', async (boundary) => {
    const { plugin, root, hookContext } = fixture()
    const api = plugin.api!
    const outDir = path.join(root, 'dist')
    const bundle = { 'page.txt': { type: 'asset', fileName: 'page.txt', source: 'native bytes' } } as OutputBundle
    await handler(plugin.generateBundle).call(hookContext, {}, bundle, true)
    await handler(plugin.writeBundle).call(hookContext, {}, bundle)
    const previousEpoch = api.getEpoch()
    expect(api.readCommitted(outDir, previousEpoch)?.outputs.get('page.txt')).toBe('native bytes')
    await handler(plugin.buildStart).call(hookContext)
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    const epoch = api.getEpoch()
    const pending = api.whenCommitted(outDir, epoch)
    if (boundary === 'configResolved') {
      handler(plugin.configResolved)({ root, build: { outDir: 'dist' } })
    }
    else {
      await handler(plugin[boundary]).call(hookContext, new Error('native publication abandoned'))
    }
    expect(await pending).toBeUndefined()
    await handler(plugin.writeBundle).call(hookContext, {}, {})
    expect(api.readCommitted(outDir, epoch)).toBeUndefined()
    expect(api.readCommitted(outDir, previousEpoch)).toBeUndefined()
    expect(await api.whenCommitted(path.join(root, 'another-dist'), api.getEpoch())).toBeUndefined()
  })

  it('keeps a pending publication active after a successful buildEnd', async () => {
    const { plugin, root, hookContext } = fixture()
    const api = plugin.api!
    const outDir = path.join(root, 'dist')
    const bundle = { 'page.txt': { type: 'asset', fileName: 'page.txt', source: 'native bytes' } } as OutputBundle
    await handler(plugin.generateBundle).call(hookContext, {}, bundle, true)
    const epoch = api.getEpoch()
    const pending = api.whenCommitted(outDir, epoch)
    await handler(plugin.buildEnd).call(hookContext)
    await handler(plugin.writeBundle).call(hookContext, {}, bundle)
    expect((await pending)?.outputs.get('page.txt')).toBe('native bytes')
    expect(api.getEpoch()).toBe(epoch)
  })

  it.each(['public', 'ownership'] as const)('does not expose a no-op commit when the %s write stage fails', async (failure) => {
    const { plugin, root, hookContext } = fixture()
    const api = plugin.api!
    const outDir = path.join(root, 'dist')
    const bundle = { 'page.txt': { type: 'asset', fileName: 'page.txt', source: 'native bytes' } } as OutputBundle
    await handler(plugin.generateBundle).call(hookContext, {}, bundle, true)
    await handler(plugin.writeBundle).call(hookContext, {}, bundle)
    await handler(plugin.buildStart).call(hookContext)
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    const epoch = api.getEpoch()
    const pending = api.whenCommitted(outDir, epoch)
    const stage = failure === 'public' ? commitPublic : commit
    stage.mockRejectedValueOnce(new Error(`${failure} commit failed`))
    await expect(handler(plugin.writeBundle).call(hookContext, {}, {})).rejects.toThrow(`${failure} commit failed`)
    expect(await pending).toBeUndefined()
    expect(api.readCommitted(outDir, epoch)).toBeUndefined()
  })

  it('keeps partial views complete across compiled, public and independent outputs and retires removed files', async () => {
    const { ctx, plugin, root, hookContext } = fixture()
    const api = plugin.api!
    const outDir = path.join(root, 'dist')
    ctx.scanService = { independentSubPackageMap: new Map([['pkg', {}]]) } as CompilerContext['scanService']
    // 与独立构建的 watch.commit() 一致，先登记分包归属再保留可复用产物。
    ctx.runtimeState.build.independent.watchFiles.set('pkg', new Set())
    ctx.runtimeState.build.independent.outputs.set('pkg', { output: [
      { type: 'asset', fileName: 'pkg/page.txt', source: 'independent', names: [], originalFileNames: [] },
    ] })
    emit.mockImplementation(async (_files, _partial, emitFile) => {
      emitFile({ type: 'asset', fileName: 'public.bin', source: new Uint8Array([0, 255]) })
    })
    const first = {
      'retained.txt': { type: 'asset', fileName: 'retained.txt', source: 'retained' },
      'page.txt': { type: 'asset', fileName: 'page.txt', source: 'BASE' },
    } as OutputBundle
    await handler(plugin.generateBundle).call(hookContext, {}, first, true)
    await handler(plugin.writeBundle).call(hookContext, {}, first)
    await handler(plugin.buildStart).call(hookContext)
    ctx.runtimeState.build.hmr.isRebuild = true
    ctx.runtimeState.build.hmr.didEmitAllEntries = false
    const next = { 'page.txt': { type: 'asset', fileName: 'page.txt', source: 'FINAL' } } as OutputBundle
    await handler(plugin.generateBundle).call(hookContext, {}, next, true)
    await handler(plugin.writeBundle).call(hookContext, {}, next)
    expect(Object.fromEntries(api.readCommitted(outDir, api.getEpoch())!.outputs)).toEqual({
      'retained.txt': 'retained',
      'page.txt': 'FINAL',
      'pkg/page.txt': 'independent',
      'public.bin': new Uint8Array([0, 255]),
    })
    await handler(plugin.buildStart).call(hookContext)
    ctx.runtimeState.build.hmr.didEmitAllEntries = true
    ctx.scanService.independentSubPackageMap.clear()
    emit.mockImplementation(async () => {})
    await handler(plugin.generateBundle).call(hookContext, {}, next, true)
    await handler(plugin.writeBundle).call(hookContext, {}, next)
    expect(Object.fromEntries(api.readCommitted(outDir, api.getEpoch())!.outputs)).toEqual({ 'page.txt': 'FINAL' })
  })
})
