import type { CompilerContext } from '../../context'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputPublicationPlugin } from './publication'

const { prepare, commit, emit, commitPublic } = vi.hoisted(() => {
  const commit = vi.fn(async () => {})
  return {
    prepare: vi.fn(() => commit),
    commit,
    emit: vi.fn(async () => {}),
    commitPublic: vi.fn(async () => {}),
  }
})

vi.mock('./ownership', () => ({ prepareOutputOwnership: prepare }))
vi.mock('../asset/publication', () => ({
  createPublicAssetPublication: () => ({ configure() {}, start() {}, emit, commit: commitPublic }),
}))

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

function fixture() {
  const root = path.resolve('publication-lifetime-fixture')
  const ctx = { configService: { isDev: true }, runtimeState: createRuntimeState() } as CompilerContext
  const plugin = createOutputPublicationPlugin(ctx)
  const hookContext = { meta: { watchMode: false }, warn() {}, addWatchFile() {}, emitFile() {} }
  handler(plugin.configResolved)({ root, build: { outDir: 'dist' } })
  return { ctx, plugin, root, hookContext }
}

describe('output publication lifetime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commit.mockResolvedValue(undefined)
    emit.mockResolvedValue(undefined)
  })

  it('commits a writing output once and leaves generated snapshots without ownership work', async () => {
    const { ctx, plugin, root, hookContext } = fixture()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, false)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).not.toHaveBeenCalled()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare.mock.calls).toEqual([
      [ctx, path.join(root, 'dist'), [], false],
      [ctx, path.join(root, 'dist'), [], false, [], 'independent'],
    ])
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).toHaveBeenCalledTimes(2)
  })

  it.each(['buildStart', 'closeBundle', 'closeWatcher'] as const)('discards abandoned output ownership at %s', async (boundary) => {
    const { plugin, hookContext } = fixture()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin[boundary]).call(hookContext)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).not.toHaveBeenCalled()
    await handler(plugin.generateBundle).call(hookContext, {}, {}, true)
    await handler(plugin.writeBundle).call(hookContext)
    expect(prepare).toHaveBeenCalledTimes(2)
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
  })
})
