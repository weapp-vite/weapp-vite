import type { Plugin, PluginContext, ResolvedConfig, ViteDevServer } from 'vite'
import type { MutableCompilerContext } from '../context'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../context/shared'
import { ownsAutoRoutesTopologyChange, subscribeAutoRoutesTopology } from '../runtime/autoRoutesPlugin/topology'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoRoutes } from './autoRoutes'

const watch = vi.hoisted(() => vi.fn(() => {
  const events = new EventEmitter()
  void Promise.resolve().then(() => events.emit('ready'))
  return {
    add: vi.fn(),
    on: vi.fn(events.on.bind(events)),
    once: vi.fn(events.once.bind(events)),
    off: vi.fn(events.off.bind(events)),
    close: vi.fn(async () => {
      events.removeAllListeners()
    }),
  }
}))
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
      getSourceFingerprint: vi.fn(() => undefined as string | undefined),
      handleFileChange,
    },
  } as unknown as MutableCompilerContext
  ctx.runtimeState.build.hmr.resolvedEntryMap.set(appEntry, { id: appEntry })
  function start(
    runtime: 'miniprogram' | 'web' = 'miniprogram',
    emit?: ReturnType<typeof vi.fn>,
    hooks: { watchChange?: ReturnType<typeof vi.fn>, send?: ReturnType<typeof vi.fn> } = {},
  ) {
    const plugin = autoRoutes(ctx)[0] as Plugin
    plugin.configResolved?.({ command: emit ? 'serve' : 'build', weappVite: { runtime } } as ResolvedConfig)
    if (emit) {
      plugin.configureServer?.({
        moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
        pluginContainer: { watchChange: hooks.watchChange ?? vi.fn().mockResolvedValue(undefined) },
        watcher: { emit },
        ws: { send: hooks.send ?? vi.fn() },
      } as unknown as ViteDevServer)
    }
    plugin.buildStart?.call({} as PluginContext)
    return plugin
  }
  const event = (name: string, watcherIndex = 0) => watch.mock.results[watcherIndex]!.value.on.mock.calls
    .find(([registered]) => registered === name)?.[1] as (file: string) => void
  return {
    ctx,
    handleFileChange,
    start,
    event,
    changeSignature: () => {
      signature += 1
    },
  }
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
    const { ctx, start, event, handleFileChange, changeSignature } = setup()
    const consume = vi.fn()
    const nativeEmit = vi.fn()
    const webEmit = vi.fn()
    const webWatchChange = vi.fn().mockResolvedValue(undefined)
    const webSend = vi.fn()
    handleFileChange.mockImplementationOnce(async () => {
      changeSignature()
      return false
    })
    const release = subscribeAutoRoutesTopology(ctx, consume)
    try {
      start('miniprogram', nativeEmit)
      start('web', webEmit, { watchChange: webWatchChange, send: webSend })
      start()
      event('add')(newPage)
      await vi.waitFor(() => expect(consume).toHaveBeenCalledWith({ file: newPage, event: 'create', topologyChanged: true, receivedAtMs: expect.any(Number) }))
      expect(nativeEmit).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(webSend).toHaveBeenCalledWith({ type: 'full-reload' }))
      expect(webWatchChange).toHaveBeenCalledWith(newPage, { event: 'create' })
      expect(webEmit).not.toHaveBeenCalled()
      expect(consume).toHaveBeenCalledTimes(1)
    }
    finally {
      release()
    }
  })

  it('lets the sidecar own classic structural changes', async () => {
    const { start, handleFileChange } = setup()
    const plugin = start('miniprogram', vi.fn())
    await plugin.watchChange?.call({} as any, newPage, { event: 'delete' })
    expect(handleFileChange).not.toHaveBeenCalled()
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
    const webSend = vi.fn()
    const native = start('miniprogram', nativeEmit)
    const web = start('web', webEmit, { send: webSend })
    await start().closeBundle?.()
    await start('web').closeBundle?.()
    const sourceWatcher = watch.mock.results[0]!.value
    await native.closeBundle?.()
    await native.closeBundle?.()
    expect(sourceWatcher.close).not.toHaveBeenCalled()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)
    event('add')(newPage)
    await vi.waitFor(() => expect(webSend).toHaveBeenCalledWith({ type: 'full-reload' }))
    expect(webEmit).not.toHaveBeenCalled()
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

  it('coalesces recursive delete bursts before publishing topology', async () => {
    const { ctx, start, event, handleFileChange } = setup()
    const consume = vi.fn()
    const release = subscribeAutoRoutesTopology(ctx, consume)
    try {
      start()
      event('unlink')(newPage)
      event('unlink')('/project/src/pages/added/index.js')
      await vi.waitFor(() => expect(handleFileChange).toHaveBeenCalledTimes(2))
      expect(consume).toHaveBeenCalledOnce()
      expect(consume).toHaveBeenCalledWith({
        file: '/project/src/pages/added/index.js',
        event: 'delete',
        topologyChanged: true,
        receivedAtMs: expect.any(Number),
        sourceChanges: [
          { file: newPage, event: 'delete', topologyChanged: true, receivedAtMs: expect.any(Number) },
          { file: '/project/src/pages/added/index.js', event: 'delete', topologyChanged: true, receivedAtMs: expect.any(Number) },
        ],
      })
    }
    finally {
      release()
    }
  })

  it('serializes add/unlink scans and Web publication before processing the next batch', async () => {
    vi.useFakeTimers()
    const { ctx, start, event, handleFileChange } = setup()
    const firstScan = Promise.withResolvers<boolean>()
    const webScan = Promise.withResolvers<void>()
    const webWatchChange = vi.fn().mockResolvedValue(undefined).mockImplementationOnce(() => webScan.promise)
    const webSend = vi.fn()
    const oldPage = '/project/src/pages/previous/index.vue'
    const nextPage = '/project/src/pages/next/index.vue'
    handleFileChange.mockReturnValueOnce(firstScan.promise)
    start('web', vi.fn(), { watchChange: webWatchChange, send: webSend })
    try {
      event('add')(newPage)
      event('unlink')(oldPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(handleFileChange).toHaveBeenCalledOnce()
      expect(webWatchChange).not.toHaveBeenCalled()
      firstScan.resolve(true)
      await vi.advanceTimersByTimeAsync(0)
      expect(handleFileChange.mock.calls).toEqual([[newPage, 'rename'], [oldPage, 'rename']])
      expect(webWatchChange).toHaveBeenCalledOnce()
      expect(webSend).not.toHaveBeenCalled()

      event('add')(nextPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(handleFileChange).toHaveBeenCalledTimes(2)
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(webWatchChange.mock.calls).toEqual([
        [newPage, { event: 'create' }],
        [oldPage, { event: 'delete' }],
        [nextPage, { event: 'create' }],
      ])
      expect(webSend.mock.calls).toEqual([[{ type: 'full-reload' }], [{ type: 'full-reload' }]])
      expect(handleFileChange).toHaveBeenCalledTimes(3)
    }
    finally {
      firstScan.resolve(true)
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
    }
  })

  it('reports Web publication errors and recovers on the next structural event', async () => {
    const { ctx, start, event } = setup()
    const webWatchChange = vi.fn().mockResolvedValue(undefined).mockRejectedValueOnce(new Error('Web scan failed'))
    const webSend = vi.fn()
    start('web', vi.fn(), { watchChange: webWatchChange, send: webSend })
    try {
      event('add')(newPage)
      await vi.waitFor(() => expect(webSend).toHaveBeenCalledOnce())
      expect(webSend).toHaveBeenCalledWith({
        type: 'error',
        err: expect.objectContaining({
          message: expect.stringContaining('Web scan failed'),
          id: newPage,
          plugin: 'weapp-vite:auto-routes',
        }),
      })
      event('unlink')(newPage)
      await vi.waitFor(() => expect(webSend).toHaveBeenCalledTimes(2))
      expect(webSend).toHaveBeenLastCalledWith({ type: 'full-reload' })
      expect(webWatchChange.mock.calls).toEqual([[newPage, { event: 'create' }], [newPage, { event: 'delete' }]])
    }
    finally {
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
    }
  })

  it('retains a failed reload receipt and retries the same source generation', async () => {
    vi.useFakeTimers()
    const { ctx, start, event, handleFileChange } = setup()
    handleFileChange.mockResolvedValue(true)
    vi.mocked(ctx.autoRoutesService!.getSourceFingerprint).mockReturnValue('same-source')
    const failure = new Error('reload delivery failed')
    const send = vi.fn().mockImplementationOnce(() => {
      throw failure
    })
    start('web', vi.fn(), { send })
    try {
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(send).toHaveBeenCalledTimes(2)
      expect(send).toHaveBeenLastCalledWith({
        type: 'error',
        err: expect.objectContaining({
          id: newPage,
          message: expect.stringContaining(failure.message),
        }),
      })
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(send).toHaveBeenCalledTimes(3)
      expect(send).toHaveBeenLastCalledWith({ type: 'full-reload' })
      expect(handleFileChange).toHaveBeenCalledTimes(2)
    }
    finally {
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
    }
  })

  it('reloads changed source content even when its route signature remains unchanged', async () => {
    vi.useFakeTimers()
    const { ctx, start, event, handleFileChange } = setup()
    handleFileChange.mockResolvedValue(true)
    const fingerprint = vi.mocked(ctx.autoRoutesService!.getSourceFingerprint).mockReturnValue('first-source')
    const send = vi.fn()
    start('web', vi.fn(), { send })
    try {
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'full-reload' })
      fingerprint.mockReturnValue('changed-source')
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(send.mock.calls).toEqual([[{ type: 'full-reload' }], [{ type: 'full-reload' }]])
    }
    finally {
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
    }
  })

  it.each([false, true])('does not transfer a completed receipt to a replacement server (during send: %s)', async (duringSend) => {
    vi.useFakeTimers()
    const { ctx, start, event, handleFileChange } = setup()
    handleFileChange.mockResolvedValue(true)
    vi.mocked(ctx.autoRoutesService!.getSourceFingerprint).mockReturnValue('same-source')
    const previousSend = vi.fn()
    const plugin = start('web', vi.fn(), { send: previousSend })
    const currentSend = vi.fn()
    const replaceServer = () => plugin.configureServer?.({
      moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
      pluginContainer: { watchChange: vi.fn().mockResolvedValue(undefined) },
      watcher: { emit: vi.fn() },
      ws: { send: currentSend },
    } as unknown as ViteDevServer)
    if (duringSend) {
      previousSend.mockImplementationOnce(replaceServer)
    }
    try {
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(previousSend).toHaveBeenCalledExactlyOnceWith({ type: 'full-reload' })
      if (!duringSend) {
        replaceServer()
      }
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(currentSend).toHaveBeenCalledExactlyOnceWith({ type: 'full-reload' })
      expect(previousSend).toHaveBeenCalledOnce()
    }
    finally {
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
    }
  })

  it('revokes an in-flight Web publication and queued scans when the watcher closes', async () => {
    vi.useFakeTimers()
    const { ctx, start, event, handleFileChange } = setup()
    const webScan = Promise.withResolvers<void>()
    const webWatchChange = vi.fn(() => webScan.promise)
    const webSend = vi.fn()
    const serving = start('web', vi.fn(), { watchChange: webWatchChange, send: webSend })
    try {
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(webWatchChange).toHaveBeenCalledOnce()
      event('add')('/project/src/pages/queued/index.vue')
      await vi.advanceTimersByTimeAsync(80)
      await serving.closeBundle?.()
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(webSend).not.toHaveBeenCalled()
      expect(handleFileChange).toHaveBeenCalledOnce()

      const replacementSend = vi.fn()
      start('web', vi.fn(), { send: replacementSend })
      event('add', 1)(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(replacementSend).toHaveBeenCalledWith({ type: 'full-reload' })
      expect(webSend).not.toHaveBeenCalled()
      expect(handleFileChange).toHaveBeenCalledTimes(2)
    }
    finally {
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
    }
  })

  it('does not notify a replaced Web host after its publication scan completes', async () => {
    vi.useFakeTimers()
    const { ctx, start, event } = setup()
    const webScan = Promise.withResolvers<void>()
    const previousSend = vi.fn()
    const previousWatchChange = vi.fn(() => webScan.promise)
    const previous = start('web', vi.fn(), { watchChange: previousWatchChange, send: previousSend })
    try {
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(previousWatchChange).toHaveBeenCalledOnce()
      const currentSend = vi.fn()
      const currentWatchChange = vi.fn().mockResolvedValue(undefined)
      start('web', vi.fn(), { watchChange: currentWatchChange, send: currentSend })
      await previous.closeBundle?.()
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(previousSend).not.toHaveBeenCalled()
      expect(currentSend).not.toHaveBeenCalled()
      expect(currentWatchChange).not.toHaveBeenCalled()

      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(currentWatchChange).toHaveBeenCalledWith(newPage, { event: 'create' })
      expect(currentSend).toHaveBeenCalledWith({ type: 'full-reload' })
      expect(previousSend).not.toHaveBeenCalled()
    }
    finally {
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
    }
  })

  it('revokes captured hosts when the same serving plugins configure replacement servers', async () => {
    vi.useFakeTimers()
    const { ctx, start, event } = setup()
    const webScan = Promise.withResolvers<void>()
    const previousNativeEmit = vi.fn()
    const previousSend = vi.fn()
    const previousWatchChange = vi.fn(() => webScan.promise)
    const native = start('miniprogram', previousNativeEmit)
    const web = start('web', vi.fn(), { watchChange: previousWatchChange, send: previousSend })
    const currentNativeEmit = vi.fn()
    const currentSend = vi.fn()
    const currentWatchChange = vi.fn().mockResolvedValue(undefined)
    const configureReplacement = (plugin: Plugin, emit: ReturnType<typeof vi.fn>, hooks = {
      watchChange: vi.fn().mockResolvedValue(undefined),
      send: vi.fn(),
    }) => {
      plugin.configureServer?.({
        moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
        pluginContainer: { watchChange: hooks.watchChange },
        watcher: { emit },
        ws: { send: hooks.send },
      } as unknown as ViteDevServer)
      plugin.buildStart?.call({} as PluginContext)
    }
    try {
      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(previousWatchChange).toHaveBeenCalledOnce()
      configureReplacement(native, currentNativeEmit)
      configureReplacement(web, vi.fn(), { watchChange: currentWatchChange, send: currentSend })
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(previousSend).not.toHaveBeenCalled()
      expect(currentSend).not.toHaveBeenCalled()
      expect(currentWatchChange).not.toHaveBeenCalled()
      expect(previousNativeEmit).not.toHaveBeenCalled()
      expect(currentNativeEmit).not.toHaveBeenCalled()

      event('add')(newPage)
      await vi.advanceTimersByTimeAsync(80)
      expect(currentWatchChange).toHaveBeenCalledWith(newPage, { event: 'create' })
      expect(currentSend).toHaveBeenCalledExactlyOnceWith({ type: 'full-reload' })
      expect(currentNativeEmit).toHaveBeenCalledWith('change', appEntry)
      expect(previousSend).not.toHaveBeenCalled()
      expect(previousNativeEmit).not.toHaveBeenCalled()
    }
    finally {
      webScan.resolve()
      await vi.advanceTimersByTimeAsync(0)
      await ctx.runtimeState.watcher.sidecarWatcherMap.get('__auto-routes-source-watcher__')?.close()
      vi.useRealTimers()
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
    await vi.waitFor(() => expect(handleFileChange).toHaveBeenCalledOnce())
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
