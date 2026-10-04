import type { Plugin, PluginContext, ResolvedConfig, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../context/shared'
import { ownsAutoRoutesTopologyChange, subscribeAutoRoutesTopology } from '../runtime/autoRoutesPlugin/topology'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoRoutes } from './autoRoutes'

const watch = vi.hoisted(() => vi.fn(() => ({ add: vi.fn(), on: vi.fn(), close: vi.fn() })))
vi.mock('chokidar', () => ({ default: { watch } }))
vi.mock('../context/shared', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

const appEntry = '/project/src/app.vue'
const newPage = '/project/src/pages/added/index.vue'

function setup() {
  let signature = 0
  const handleFileChange = vi.fn(async () => {
    signature += 1
    return true
  })
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      isDev: true,
      relativeCwd: (file: string) => file.replace('/project/', ''),
      weappViteConfig: { autoRoutes: true },
      packageInfo: { rootPath: '/package' },
    },
    scanService: { appEntry: { path: appEntry }, markDirty: vi.fn() },
    autoRoutesService: {
      isEnabled: () => true,
      getWatchDirectories: () => ['/project/src/pages'],
      isPageDeclarationSource: () => false,
      getPageDeclarationOwners: () => [],
      getSignature: () => String(signature),
      handleFileChange,
    },
  } as unknown as MutableCompilerContext
  ctx.runtimeState.build.hmr.resolvedEntryMap.set(appEntry, { id: appEntry })
  function start(runtime: 'miniprogram' | 'web' = 'miniprogram', emit?: ReturnType<typeof vi.fn>) {
    const plugin = autoRoutes(ctx)[0] as Plugin
    plugin.configResolved?.({ command: emit ? 'serve' : 'build', weappVite: { runtime } } as ResolvedConfig)
    if (emit) {
      plugin.configureServer?.({
        moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
        watcher: { emit },
        ws: { send: vi.fn() },
      } as unknown as ViteDevServer)
    }
    plugin.buildStart?.call({} as PluginContext)
    return plugin
  }
  const event = (name: string, watcherIndex = 0) => watch.mock.results[watcherIndex]!.value.on.mock.calls
    .find(([registered]) => registered === name)?.[1] as (file: string) => void
  return { ctx, handleFileChange, start, event }
}

describe('auto routes topology delivery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('owns only active watcher inputs and releases ownership on watcher close', async () => {
    const { ctx, start } = setup()
    const release = subscribeAutoRoutesTopology(ctx, vi.fn())
    start()
    try {
      for (const [file, expected] of [
        [newPage, true],
        ['/project/src/pages/added/index.js', true],
        ['/project/src/pages/added/index.json', false],
        ['/project/src/pages/added/index.wxml', false],
        ['/project/src/helpers.ts', false],
      ] as const) {
        expect(ownsAutoRoutesTopologyChange(ctx, { file, event: 'create' })).toBe(expected)
        expect(ownsAutoRoutesTopologyChange(ctx, { file, event: 'update' })).toBe(false)
      }
      ctx.configService!.weappViteConfig.autoRoutes = { watch: false }
      expect(ownsAutoRoutesTopologyChange(ctx, { file: newPage, event: 'create' })).toBe(false)
      ctx.configService!.weappViteConfig.autoRoutes = true
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')!.close()
      expect(ownsAutoRoutesTopologyChange(ctx, { file: newPage, event: 'create' })).toBe(false)
    }
    finally {
      release()
    }
  })

  it('delivers standalone topology changes across multiple snapshot plugin instances', async () => {
    const { ctx, start, event } = setup()
    const consume = vi.fn()
    const release = subscribeAutoRoutesTopology(ctx, consume)
    try {
      let count = 0
      for (const [name, type] of [['add', 'create'], ['unlink', 'delete'], ['add', 'create']] as const) {
        const snapshot = start()
        event(name)(newPage)
        count += 1
        await vi.waitFor(() => expect(consume).toHaveBeenCalledTimes(count))
        expect(consume).toHaveBeenLastCalledWith({ file: newPage, event: type, topologyChanged: true, receivedAtMs: expect.any(Number) })
        await snapshot.closeBundle?.()
      }
      expect(watch).toHaveBeenCalledTimes(1)
      expect(consume).toHaveBeenCalledTimes(3)
    }
    finally {
      release()
    }
  })

  it('keeps Web refresh while avoiding a second native App notification', async () => {
    const { ctx, start, event } = setup()
    const consume = vi.fn()
    const nativeEmit = vi.fn()
    const webEmit = vi.fn()
    const release = subscribeAutoRoutesTopology(ctx, consume)
    try {
      start('miniprogram', nativeEmit)
      start('web', webEmit)
      start()
      event('add')(newPage)
      await vi.waitFor(() => expect(consume).toHaveBeenCalledWith({ file: newPage, event: 'create', topologyChanged: true, receivedAtMs: expect.any(Number) }))
      expect(nativeEmit).not.toHaveBeenCalled()
      expect(webEmit).toHaveBeenCalledWith('change', appEntry)
      expect(consume).toHaveBeenCalledTimes(1)
    }
    finally {
      release()
    }
  })

  it('preserves a serving host through temporary snapshots when no classic consumer is attached', async () => {
    const { start, event } = setup()
    const nativeEmit = vi.fn()
    const serving = start('miniprogram', nativeEmit)
    const snapshot = start()
    await snapshot.closeBundle?.()
    event('add')(newPage)
    await vi.waitFor(() => expect(nativeEmit).toHaveBeenCalledWith('change', appEntry))
    await serving.closeBundle?.()
  })

  it.each([
    { runtime: 'miniprogram' as const, snapshots: 1 },
    { runtime: 'miniprogram' as const, snapshots: 3 },
    { runtime: 'web' as const, snapshots: 1 },
    { runtime: 'web' as const, snapshots: 3 },
  ])('releases the last $runtime host after $snapshots temporary snapshots', async ({ runtime, snapshots }) => {
    const { ctx, start } = setup()
    const serving = start(runtime, vi.fn())
    for (let index = 0; index < snapshots; index += 1) {
      await start(runtime).closeBundle?.()
    }
    const sourceWatcher = watch.mock.results[0]!.value
    expect(sourceWatcher.close).not.toHaveBeenCalled()
    await serving.closeBundle?.()
    expect(sourceWatcher.close).toHaveBeenCalledOnce()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
    expect(ownsAutoRoutesTopologyChange(ctx, { file: newPage, event: 'create' })).toBe(false)
    await serving.closeBundle?.()
    expect(sourceWatcher.close).toHaveBeenCalledOnce()
  })

  it('keeps the other runtime host when a replaced snapshot cache is released', async () => {
    const { ctx, start, event } = setup()
    const nativeEmit = vi.fn()
    const webEmit = vi.fn()
    const native = start('miniprogram', nativeEmit)
    const web = start('web', webEmit)
    await start().closeBundle?.()
    await start('web').closeBundle?.()
    const sourceWatcher = watch.mock.results[0]!.value
    await native.closeBundle?.()
    await native.closeBundle?.()
    expect(sourceWatcher.close).not.toHaveBeenCalled()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)
    event('add')(newPage)
    await vi.waitFor(() => expect(webEmit).toHaveBeenCalledWith('change', appEntry))
    expect(nativeEmit).not.toHaveBeenCalled()
    await web.closeBundle?.()
    expect(sourceWatcher.close).toHaveBeenCalledOnce()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
  })

  it('ignores stale closes after a newer host or watcher acquires ownership', async () => {
    const { ctx, start, event } = setup()
    const previous = start('miniprogram', vi.fn())
    const emit = vi.fn()
    const current = start('miniprogram', emit)
    await start().closeBundle?.()
    const firstWatcher = watch.mock.results[0]!.value
    await previous.closeBundle?.()
    expect(firstWatcher.close).not.toHaveBeenCalled()
    event('add')(newPage)
    await vi.waitFor(() => expect(emit).toHaveBeenCalledWith('change', appEntry))
    await current.closeBundle?.()
    expect(firstWatcher.close).toHaveBeenCalledOnce()

    const replacement = start('miniprogram', vi.fn())
    const secondWatcher = watch.mock.results[1]!.value
    await previous.closeBundle?.()
    await current.closeBundle?.()
    expect(secondWatcher.close).not.toHaveBeenCalled()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)
    await replacement.closeBundle?.()
    expect(secondWatcher.close).toHaveBeenCalledOnce()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
  })

  it('returns unchanged source events to the consumer and does not publish rejected scans', async () => {
    const { ctx, handleFileChange, start, event } = setup()
    handleFileChange.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('invalid route'))
    const consume = vi.fn()
    const release = subscribeAutoRoutesTopology(ctx, consume)
    try {
      start()
      event('add')(newPage)
      await vi.waitFor(() => expect(consume).toHaveBeenCalledWith({ file: newPage, event: 'create', topologyChanged: false, receivedAtMs: expect.any(Number) }))
      event('unlink')(newPage)
      await vi.waitFor(() => expect(handleFileChange).toHaveBeenCalledTimes(2))
      expect(consume).toHaveBeenCalledTimes(1)
    }
    finally {
      release()
    }
  })

  it('publishes after cache invalidation while retaining the pre-scan event time', async () => {
    const { ctx, handleFileChange, start, event } = setup()
    const scan = Promise.withResolvers<boolean>()
    handleFileChange.mockReturnValueOnce(scan.promise)
    const consume = vi.fn<(change: { receivedAtMs?: number }) => void>(() => {
      expect(ctx.scanService!.markDirty).toHaveBeenCalledOnce()
    })
    const release = subscribeAutoRoutesTopology(ctx, consume)
    try {
      start()
      const before = performance.now()
      event('add')(newPage)
      const afterReceipt = performance.now()
      expect(consume).not.toHaveBeenCalled()
      scan.resolve(true)
      await vi.waitFor(() => expect(consume).toHaveBeenCalledOnce())
      const change = consume.mock.calls[0]![0]
      expect(change.receivedAtMs).toBeGreaterThanOrEqual(before)
      expect(change.receivedAtMs).toBeLessThanOrEqual(afterReceipt)
    }
    finally {
      release()
    }
  })

  it.each([false, true].flatMap(replacement => ['changed', 'unchanged', 'rejected'].map(result => ({ replacement, result }))))('discards $result scans from a closed watcher (replacement: $replacement)', async ({ replacement, result }) => {
    const { ctx, start, event, handleFileChange } = setup()
    const pending = Promise.withResolvers<boolean>()
    handleFileChange.mockReturnValueOnce(pending.promise)
    const oldConsume = vi.fn()
    const releaseOld = subscribeAutoRoutesTopology(ctx, oldConsume)
    start()
    event('add')(newPage)
    const previous = ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')!
    await previous.close()
    releaseOld()
    const currentConsume = vi.fn()
    const releaseCurrent = subscribeAutoRoutesTopology(ctx, currentConsume)
    if (replacement) {
      start()
    }
    try {
      if (result === 'rejected') {
        pending.reject(new Error('obsolete scan failure'))
      }
      else {
        pending.resolve(result === 'changed')
      }
      await Promise.allSettled([pending.promise])
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(oldConsume).not.toHaveBeenCalled()
      expect(currentConsume).not.toHaveBeenCalled()
      expect(watch.mock.results[0]!.value.add).not.toHaveBeenCalled()
      expect(ctx.scanService!.markDirty).not.toHaveBeenCalled()
      expect(logger.error).not.toHaveBeenCalled()
      event('add')(newPage)
      expect(handleFileChange).toHaveBeenCalledOnce()
      if (replacement) {
        event('add', 1)(newPage)
        await vi.waitFor(() => expect(currentConsume).toHaveBeenCalledOnce())
        expect(ownsAutoRoutesTopologyChange(ctx, { file: newPage, event: 'create' })).toBe(true)
      }
    }
    finally {
      releaseCurrent()
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
    }
  })
})
