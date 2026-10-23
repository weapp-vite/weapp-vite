import type { RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { DevModuleGraphChange } from '../../moduleGraph/devProvider'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContext, mocks } from './serviceRestart/fixture'

// 共享夹具先登记 mock，再加载生产模块；不经重导出提前求值。
const { createBuildService } = await import('./service')

async function waitForConfigurationLoad(entered: Promise<void>) {
  await vi.waitFor(() => expect(mocks.restarts).toHaveLength(1))
  await Promise.race([
    entered,
    Promise.all(mocks.restarts).then(() => {
      throw new Error('Configuration restart completed before its configuration load checkpoint')
    }),
  ])
}

function installWatchers() {
  const sidecars: Array<EventEmitter & { add: ReturnType<typeof vi.fn>, unwatch: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn> }> = []
  const providers: Array<{ change: (change: DevModuleGraphChange) => void, close: ReturnType<typeof vi.fn> }> = []
  mocks.watch.mockImplementation(() => {
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
      close: vi.fn(async () => { watcher.removeAllListeners() }),
    })
    sidecars.push(watcher)
    setImmediate(() => watcher.emit('ready'))
    return watcher
  })
  mocks.provider.mockImplementation(async (_ctx: unknown, _options: unknown, change: (change: DevModuleGraphChange) => void) => {
    const provider = { change, close: vi.fn(async () => {}) }
    providers.push(provider)
    return provider
  })
  return { sidecars, providers }
}

beforeEach(() => {
  vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
  mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
  mocks.build.mockResolvedValue({ output: [] })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  mocks.restarts.length = 0
})

describe('classic direct configuration generation restart', () => {
  it('retires a generation changed before readiness and publishes its latest configuration once', async () => {
    const ctx = createContext()
    const configFile = '/project/vite.config.ts'
    ctx.configService.configFileDependencies = [configFile]
    const { sidecars } = installWatchers()
    const createWatcher = mocks.watch.getMockImplementation()!
    mocks.watch.mockImplementation((...args: unknown[]) => {
      const watcher = createWatcher(...args) as EventEmitter
      if (sidecars.length === 1) {
        queueMicrotask(() => watcher.emit('all', 'change', configFile))
      }
      return watcher
    })
    let effectiveConfig = 'CONFIG-A'
    const publications: string[] = []
    ctx.configService.load.mockImplementation(async () => {
      effectiveConfig = 'CONFIG-B'
    })
    mocks.build.mockImplementation(async () => {
      publications.push(effectiveConfig)
      return { output: [] }
    })
    let watcher: RolldownWatcher | undefined
    try {
      watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
      await Promise.all(mocks.restarts)
      expect(publications).toEqual(['CONFIG-B'])
      expect(ctx.configService.load).toHaveBeenCalledOnce()
      expect(sidecars).toHaveLength(3)
      expect(sidecars[1]!.close).toHaveBeenCalledOnce()
      expect(mocks.logger.error).not.toHaveBeenCalled()
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      await Promise.allSettled(mocks.restarts)
      await watcher?.close()
      await ctx.watcherService.closeAll()
    }
  })

  it('does not publish or start a replacement after shutdown before configuration watcher readiness', async () => {
    const ctx = createContext()
    ctx.configService.configFileDependencies = ['/project/vite.config.ts']
    const sidecar = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
      close: vi.fn(async () => { sidecar.removeAllListeners() }),
    })
    mocks.watch.mockReturnValue(sidecar)
    const starting = createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true })
    await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledOnce())
    await Promise.all([starting, ctx.watcherService.closeAll()])
    expect(mocks.build).not.toHaveBeenCalled()
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(sidecar.close).toHaveBeenCalledOnce()
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
    expect(mocks.logger.error).not.toHaveBeenCalled()
    expect(mocks.forbiddenIo).not.toHaveBeenCalled()
  })

  it('publishes only the newest configuration and sources after draining pending old-generation work', async () => {
    const ctx = createContext()
    const configFile = '/project/vite.config.ts'
    const sourceFile = '/project/src/pages/home/index.ts'
    ctx.configService.configFileDependencies = [configFile]
    vi.spyOn(ctx.moduleGraphService, 'hasModule').mockImplementation(file => file === sourceFile)
    const { sidecars, providers } = installWatchers()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const publications: Array<{ config: string, source: string }> = []
    let config = 'CONFIG-A'
    let effectiveConfig = 'CONFIG-A'
    let source = 'SOURCE-A'
    ctx.configService.load.mockImplementation(async () => {
      expect(providers[0]!.close).toHaveBeenCalledOnce()
      effectiveConfig = config
      if (ctx.configService.load.mock.calls.length === 1) {
        entered.resolve()
        await release.promise
      }
    })
    mocks.build.mockImplementation(async () => {
      publications.push({ config: effectiveConfig, source })
      return { output: [] }
    })
    let watcher: RolldownWatcher | undefined
    try {
      watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
      providers[0]!.change({ event: 'update', file: sourceFile })
      config = 'CONFIG-B'
      sidecars[0]!.emit('all', 'change', configFile)
      // 同一配置保存即便经过其他 watcher，也不能先发布旧的有效配置。
      sidecars[1]!.emit('all', 'change', configFile)
      providers[0]!.change({ event: 'update', file: configFile })
      await waitForConfigurationLoad(entered.promise)
      expect(publications).toEqual([{ config: 'CONFIG-A', source: 'SOURCE-A' }])
      expect(sidecars[0]!.close).not.toHaveBeenCalled()
      config = 'CONFIG-C'
      source = 'SOURCE-C'
      sidecars[0]!.emit('all', 'change', configFile)
      providers[0]!.change({ event: 'update', file: sourceFile })
      release.resolve()
      await vi.waitFor(() => expect(publications).toHaveLength(2))
      await Promise.all(mocks.restarts)
      expect(publications).toEqual([
        { config: 'CONFIG-A', source: 'SOURCE-A' },
        { config: 'CONFIG-C', source: 'SOURCE-C' },
      ])
      expect(ctx.configService.load).toHaveBeenCalledTimes(2)
      expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(2)
      expect(sidecars).toHaveLength(3)
      expect(sidecars[1]!.close).toHaveBeenCalledOnce()
      expect(sidecars[0]!.close).not.toHaveBeenCalled()
      config = 'CONFIG-D'
      sidecars[0]!.emit('all', 'change', configFile)
      await vi.waitFor(() => expect(publications).toHaveLength(3))
      await Promise.all(mocks.restarts)
      expect(publications[2]).toEqual({ config: 'CONFIG-D', source: 'SOURCE-C' })
      expect(sidecars).toHaveLength(4)
      expect(mocks.logger.error).not.toHaveBeenCalled()
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
      await watcher.close()
      expect(sidecars.every(sidecar => sidecar.close.mock.calls.length === 1)).toBe(true)
      expect(providers.every(provider => provider.close.mock.calls.length === 1)).toBe(true)
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
    }
    finally {
      release.resolve()
      await Promise.allSettled(mocks.restarts)
      await watcher?.close()
      await ctx.watcherService.closeAll()
    }
  })

  it('joins shutdown during direct configuration load without starting or leaking another generation', async () => {
    const ctx = createContext()
    const configFile = '/project/vite.config.ts'
    ctx.configService.configFileDependencies = [configFile]
    const { sidecars, providers } = installWatchers()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    ctx.configService.load.mockImplementation(async () => {
      entered.resolve()
      await release.promise
    })
    let watcher: RolldownWatcher | undefined
    try {
      watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
      sidecars[0]!.emit('all', 'change', configFile)
      await waitForConfigurationLoad(entered.promise)
      let closed = false
      const closing = watcher.close()
      expect(watcher.close()).toBe(closing)
      void closing.then(() => closed = true)
      sidecars[0]!.emit('all', 'change', configFile)
      await Promise.resolve()
      expect(closed).toBe(false)
      release.resolve()
      await Promise.all([closing, ...mocks.restarts])
      expect(mocks.build).toHaveBeenCalledOnce()
      expect(providers).toHaveLength(1)
      expect(sidecars).toHaveLength(2)
      expect(sidecars.every(sidecar => sidecar.close.mock.calls.length === 1)).toBe(true)
      expect(providers[0]!.close).toHaveBeenCalledOnce()
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
      expect(mocks.logger.error).not.toHaveBeenCalled()
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      release.resolve()
      await Promise.allSettled(mocks.restarts)
      await watcher?.close()
      await ctx.watcherService.closeAll()
    }
  })

  it('finishes an in-flight publication before loading configuration and starting its replacement', async () => {
    const ctx = createContext()
    const configFile = '/project/vite.config.ts'
    const sourceFile = '/project/src/pages/home/index.ts'
    ctx.configService.configFileDependencies = [configFile]
    vi.spyOn(ctx.moduleGraphService, 'hasModule').mockImplementation(file => file === sourceFile)
    vi.spyOn(ctx.moduleGraphService, 'collectAffectedEntries').mockReturnValue(new Set([sourceFile]))
    const { sidecars, providers } = installWatchers()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    mocks.build.mockImplementation(async () => {
      if (mocks.build.mock.calls.length === 2) {
        entered.resolve()
        await release.promise
      }
      return { output: [] }
    })
    let watcher: RolldownWatcher | undefined
    try {
      watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
      providers[0]!.change({ event: 'update', file: sourceFile })
      await entered.promise
      sidecars[0]!.emit('all', 'change', configFile)
      await Promise.resolve()
      expect(ctx.configService.load).not.toHaveBeenCalled()
      expect(providers[0]!.close).not.toHaveBeenCalled()
      release.resolve()
      await vi.waitFor(() => expect(mocks.build).toHaveBeenCalledTimes(3))
      await Promise.all(mocks.restarts)
      expect(ctx.configService.load).toHaveBeenCalledOnce()
      expect(providers[0]!.close).toHaveBeenCalledOnce()
      expect(mocks.logger.error).not.toHaveBeenCalled()
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      release.resolve()
      await Promise.allSettled(mocks.restarts)
      await watcher?.close()
      await ctx.watcherService.closeAll()
    }
  })

  it('drains a configuration watcher readiness failure before the initial publication', async () => {
    const ctx = createContext()
    ctx.configService.configFileDependencies = ['/project/vite.config.ts']
    const startupError = new Error('configuration watch readiness failed')
    const cleanupError = new Error('configuration watch close failed')
    const sidecar = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
      close: vi.fn(async () => {
        sidecar.removeAllListeners()
        throw cleanupError
      }),
    })
    mocks.watch.mockReturnValue(sidecar)
    setImmediate(() => sidecar.emit('error', startupError))
    const result = createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true })
    const leafErrors = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
    const failure = await result.then(() => undefined, error => error)
    expect(leafErrors(failure)).toEqual([startupError, cleanupError])
    expect(sidecar.close).toHaveBeenCalledOnce()
    expect(mocks.build).not.toHaveBeenCalled()
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
    expect(mocks.forbiddenIo).not.toHaveBeenCalled()
  })
})
