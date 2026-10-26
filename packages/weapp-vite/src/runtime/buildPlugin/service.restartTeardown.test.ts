import type { RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { createDevBuildWatcher } from './devBuildWatcher'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claimSidecarDelivery, ownsSidecarDelivery } from '../watch/sidecarDelivery'
import { deferWatcherResourceCleanup } from '../watcherPlugin'
import { createContext, mocks } from './serviceRestart/fixture'

// 共享夹具先登记 mock，再加载生产模块；不经重导出提前求值。
const { createBuildService } = await import('./service')

async function waitForRestartCheckpoint(checkpoint: Promise<void>, name: string, count = 1) {
  await vi.waitFor(() => expect(mocks.restarts).toHaveLength(count))
  await Promise.race([
    checkpoint,
    Promise.all(mocks.restarts).then(() => {
      throw new Error(`Configuration restart completed before ${name}`)
    }),
  ])
}

beforeEach(() => {
  mocks.watch.mockImplementation(() => ({ add: vi.fn(), on: vi.fn(), close: vi.fn(async () => {}) }))
  mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  mocks.restarts.length = 0
})

describe('classic config restart teardown ownership', () => {
  it.each((['provider', 'readiness', 'publication'] as const).flatMap(checkpoint => [false, true].map(failedCleanup => ({ checkpoint, failedCleanup }))))('automatically drains a failed replacement $checkpoint without caller close (cleanup failure: $failedCleanup)', async ({ checkpoint, failedCleanup }) => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const ctx = createContext()
    const other = createContext()
    const source = '/project/src/pages/home/index.wxss'
    const releaseOther = claimSidecarDelivery(other as unknown as MutableCompilerContext, () => true, other.watcherService)
    const startupFailure = new Error(`replacement ${checkpoint} failed`)
    const cleanupFailure = new Error('replacement sidecar cleanup failed')
    const providers: { close: ReturnType<typeof vi.fn> }[] = []
    const controllers: ReturnType<typeof createDevBuildWatcher>[] = []
    const sidecars: Array<EventEmitter & { close: ReturnType<typeof vi.fn> }> = []
    const deferredClose = vi.fn(async () => {})
    const auxiliaryClose = vi.fn(async () => {})
    mocks.watch.mockImplementation(() => {
      const replacement = sidecars.length === 1
      const sidecar = Object.assign(new EventEmitter(), {
        add: vi.fn(),
        close: vi.fn(async () => {
          sidecar.removeAllListeners()
          if (replacement && failedCleanup) {
            throw cleanupFailure
          }
        }),
      })
      sidecars.push(sidecar)
      if (replacement) {
        ctx.watcherService.sidecarWatcherMap.set('replacement-auto-import', { close: auxiliaryClose })
        expect(deferWatcherResourceCleanup(ctx.watcherService, deferredClose)).toBe(true)
      }
      setImmediate(() => {
        if (replacement && checkpoint === 'readiness') {
          sidecar.emit('error', startupFailure)
        }
        else {
          sidecar.emit('ready')
        }
      })
      return sidecar
    })
    mocks.provider.mockImplementation(async () => {
      if (providers.length === 1 && checkpoint === 'provider') {
        throw startupFailure
      }
      const provider = { close: vi.fn(async () => {}) }
      providers.push(provider)
      return provider
    })
    mocks.build.mockImplementation(async () => {
      if (mocks.build.mock.calls.length === 2 && checkpoint === 'publication') {
        throw startupFailure
      }
      return { output: [] }
    })
    const { createDevBuildWatcher: realController } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controllerSpy = vi.spyOn(await import('./devBuildWatcher'), 'createDevBuildWatcher').mockImplementation(() => {
      const controller = realController()
      controllers.push(controller)
      return controller
    })
    const leafErrors = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
    let original: RolldownWatcher | undefined
    try {
      const service = createBuildService(ctx as unknown as MutableCompilerContext)
      original = await service.build({ skipNpm: true }) as RolldownWatcher
      expect(ownsSidecarDelivery(ctx as unknown as MutableCompilerContext, source, 'create')).toBe(true)
      service.requestConfigRestart('app')
      controllers[0]!.emitEvent({ code: 'END' })
      await Promise.allSettled(mocks.restarts)
      // 不能靠测试主动 close 完成收尾；生产错误处理必须自行 drain 整个 session。
      await vi.waitFor(() => expect(mocks.logger.error).toHaveBeenCalledOnce())
      const failure = mocks.logger.error.mock.calls[0]![0]
      expect(leafErrors(failure)).toContain(startupFailure)
      if (failedCleanup) {
        expect(leafErrors(failure)).toContain(cleanupFailure)
      }
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(ctx.runtimeState.build.independent.watchListeners.size).toBe(0)
      expect(ownsSidecarDelivery(ctx as unknown as MutableCompilerContext, source, 'create')).toBe(false)
      expect(ownsSidecarDelivery(other as unknown as MutableCompilerContext, source, 'create')).toBe(true)
      expect(providers.every(provider => provider.close.mock.calls.length === 1)).toBe(true)
      expect(sidecars.every(sidecar => sidecar.close.mock.calls.length === 1)).toBe(true)
      expect(deferredClose).toHaveBeenCalledOnce()
      expect(auxiliaryClose).toHaveBeenCalledOnce()
      const closing = original.close()
      expect(original.close()).toBe(closing)
      expect(leafErrors(await closing.then(() => undefined, error => error))).toContain(startupFailure)
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      await Promise.allSettled(mocks.restarts)
      await ctx.watcherService.closeAll().catch(() => {})
      releaseOther()
      await other.watcherService.closeAll()
      controllerSpy.mockRestore()
    }
  })

  it.each([false, true])('drains startup resources before rejecting without a registered public controller: cleanup failure %s', async (failedCleanup) => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const ctx = createContext()
    const startupFailure = new Error('initial publication failed')
    const cleanupFailure = new Error('startup sidecar cleanup failed')
    const sidecar = Promise.withResolvers<void>()
    const sidecarEntered = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const sidecarClose = vi.fn(async () => {
      sidecarEntered.resolve()
      await sidecar.promise
      if (failedCleanup) {
        throw cleanupFailure
      }
    })
    const webClose = vi.fn(() => web.promise)
    const deferredClose = vi.fn(async () => {})
    const providerClose = vi.fn(async () => {})
    const context = ctx as unknown as MutableCompilerContext
    context.webService = { close: webClose } as unknown as NonNullable<MutableCompilerContext['webService']>
    mocks.provider.mockResolvedValue({ close: providerClose })
    mocks.build.mockImplementation(async () => {
      // 模拟自动导入等插件在首构中登记资源，尚未来得及返回公共 watcher。
      expect(deferWatcherResourceCleanup(ctx.watcherService, deferredClose)).toBe(true)
      ctx.watcherService.sidecarWatcherMap.set('initial-auto-import', { close: sidecarClose })
      throw startupFailure
    })
    let result: PromiseSettledResult<unknown> | undefined
    const building = createBuildService(context).build({ skipNpm: true })
    const observed = building.then(
      value => result = { status: 'fulfilled', value },
      reason => result = { status: 'rejected', reason },
    )
    try {
      await Promise.race([
        sidecarEntered.promise,
        building.then(() => {
          throw new Error('Initial build completed before startup sidecar cleanup')
        }),
      ])
      expect(result).toBeUndefined()
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
      expect(webClose).toHaveBeenCalledOnce()
      expect(deferredClose).toHaveBeenCalledOnce()
      expect(providerClose).toHaveBeenCalledOnce()
      sidecar.resolve()
      await sidecar.promise
      await Promise.resolve()
      expect(result).toBeUndefined()
      web.resolve()
      await observed
      if (failedCleanup) {
        expect(result).toMatchObject({ status: 'rejected', reason: { errors: [startupFailure, cleanupFailure] } })
      }
      else {
        expect(result).toEqual({ status: 'rejected', reason: startupFailure })
      }
      expect(sidecarClose).toHaveBeenCalledOnce()
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      sidecar.resolve()
      web.resolve()
      await observed
    }
  })

  it('owns the first generation before replaying END and closes later generations through the first handle', async () => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const ctx = createContext()
    const controllers: ReturnType<typeof createDevBuildWatcher>[] = []
    const providers: { close: ReturnType<typeof vi.fn> }[] = []
    const publications = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
    const precedingProviderClosed: boolean[] = []
    mocks.provider.mockImplementation(async () => {
      const provider = { close: vi.fn(async () => {}) }
      providers.push(provider)
      return provider
    })
    mocks.watch.mockImplementation(() => ({ add: vi.fn(), on: vi.fn(), close: vi.fn(async () => {}) }))
    mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
    mocks.build.mockImplementation(async () => {
      const previous = mocks.build.mock.calls.length - 2
      if (previous >= 0) {
        precedingProviderClosed.push(providers[previous]!.close.mock.calls.length === 1)
        publications[previous]!.resolve()
      }
      return { output: [] }
    })
    const { createDevBuildWatcher: realController } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    let service: ReturnType<typeof createBuildService>
    const controllerSpy = vi.spyOn(await import('./devBuildWatcher'), 'createDevBuildWatcher').mockImplementation(() => {
      const controller = realController()
      if (controllers.length === 0) {
        const subscribe = controller.watcher.on.bind(controller.watcher)
        controller.watcher.on = (event, listener) => {
          if (event === 'event') {
            service.requestConfigRestart('app')
          }
          return subscribe(event, listener)
        }
      }
      controllers.push(controller)
      return controller
    })
    try {
      service = createBuildService(ctx as unknown as MutableCompilerContext)
      const first = await service.build({ skipNpm: true }) as RolldownWatcher
      await waitForRestartCheckpoint(publications[0]!.promise, 'first replacement publication')
      await Promise.all(mocks.restarts)
      service.requestConfigRestart('app')
      controllers[1]!.emitEvent({ code: 'END' })
      await waitForRestartCheckpoint(publications[1]!.promise, 'second replacement publication', 2)
      await Promise.all(mocks.restarts)
      expect(precedingProviderClosed).toEqual([true, true])
      expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(controllers[2]!.watcher)
      const closing = first.close()
      expect(first.close()).toBe(closing)
      await closing
      expect(providers.every(provider => provider.close.mock.calls.length === 1)).toBe(true)
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      await Promise.allSettled(mocks.restarts)
      await ctx.watcherService.closeAll()
      controllerSpy.mockRestore()
    }
  })

  it.each(['controller', 'service'] as const)('retains a completed provider cleanup failure when the %s closes later', async (entry) => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const ctx = createContext()
    const failure = new Error('provider resource close failed')
    const controllers: ReturnType<typeof createDevBuildWatcher>[] = []
    const providerClose = vi.fn().mockRejectedValue(failure)
    mocks.provider.mockResolvedValue({ close: providerClose })
    mocks.watch.mockImplementation(() => ({ add: vi.fn(), on: vi.fn(), close: vi.fn(async () => {}) }))
    mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
    mocks.build.mockResolvedValue({ output: [] })
    const { createDevBuildWatcher: realController } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controllerSpy = vi.spyOn(await import('./devBuildWatcher'), 'createDevBuildWatcher').mockImplementation(() => {
      const controller = realController()
      controllers.push(controller)
      return controller
    })
    try {
      const service = createBuildService(ctx as unknown as MutableCompilerContext)
      const first = await service.build({ skipNpm: true }) as RolldownWatcher
      service.requestConfigRestart('app')
      controllers[0]!.emitEvent({ code: 'START' })
      controllers[0]!.emitEvent({ code: 'END' })
      await vi.waitFor(() => expect(mocks.restarts).toHaveLength(1))
      expect(await Promise.allSettled(mocks.restarts)).toEqual([{ status: 'rejected', reason: failure }])
      await vi.waitFor(() => expect(mocks.logger.error).toHaveBeenCalledWith(failure))
      expect(ctx.configService.load).not.toHaveBeenCalled()
      expect(mocks.build).toHaveBeenCalledOnce()
      expect(mocks.provider).toHaveBeenCalledOnce()
      expect(controllers).toHaveLength(1)
      expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
      expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)

      const closing = entry === 'service' ? ctx.watcherService.closeAll() : first.close()
      await expect(closing).rejects.toBe(failure)
      const publicClose = first.close()
      expect(first.close()).toBe(publicClose)
      await expect(publicClose).rejects.toBe(failure)
      await expect(ctx.watcherService.closeAll()).rejects.toBe(failure)
      expect(providerClose).toHaveBeenCalledOnce()
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
    }
    finally {
      await Promise.allSettled(mocks.restarts)
      await Promise.allSettled(controllers.map(controller => controller.watcher.close()))
      await Promise.allSettled([ctx.watcherService.closeAll()])
      controllerSpy.mockRestore()
    }
  })

  it.each([
    { checkpoint: 'config-load', entry: 'controller' },
    { checkpoint: 'config-load', entry: 'service' },
    { checkpoint: 'initial-publication', entry: 'controller' },
    { checkpoint: 'initial-publication', entry: 'service' },
  ] as const)('does not leave a new generation after $entry shutdown during $checkpoint', async ({ checkpoint, entry }) => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const trace: string[] = []
    const providers: { close: ReturnType<typeof vi.fn> }[] = []
    const controllers: ReturnType<typeof createDevBuildWatcher>[] = []
    const ctx = createContext()
    const originalSet = ctx.watcherService.setRollupWatcher.bind(ctx.watcherService)
    ctx.watcherService.setRollupWatcher = (watcher, root) => {
      trace.push(`registered:${controllers.length}`)
      originalSet(watcher, root)
    }
    mocks.provider.mockImplementation(async () => {
      const provider = { close: vi.fn(async () => {}) }
      providers.push(provider)
      return provider
    })
    mocks.watch.mockImplementation(() => ({ add: vi.fn(), on: vi.fn(), close: vi.fn(async () => {}) }))
    mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
    mocks.build.mockImplementation(async () => {
      if (checkpoint === 'initial-publication' && mocks.build.mock.calls.length === 2) {
        trace.push('new-publication-entered')
        entered.resolve()
        await release.promise
      }
      return { output: [] }
    })
    if (checkpoint === 'config-load') {
      ctx.configService.load.mockImplementation(async () => {
        trace.push('config-load-entered')
        entered.resolve()
        await release.promise
      })
    }
    const { createDevBuildWatcher: realController } = await vi.importActual<typeof import('./devBuildWatcher')>('./devBuildWatcher')
    const controllerSpy = vi.spyOn(await import('./devBuildWatcher'), 'createDevBuildWatcher').mockImplementation(() => {
      const controller = realController()
      controllers.push(controller)
      return controller
    })
    let watcher: RolldownWatcher | undefined
    try {
      const service = createBuildService(ctx as unknown as MutableCompilerContext)
      watcher = await service.build({ skipNpm: true }) as RolldownWatcher
      service.requestConfigRestart('app')
      controllers[0]!.emitEvent({ code: 'START' })
      controllers[0]!.emitEvent({ code: 'END' })
      await waitForRestartCheckpoint(entered.promise, `${checkpoint} checkpoint`)
      trace.push('shutdown-started')
      const shutdown = (async () => {
        await (entry === 'service' ? ctx.watcherService.closeAll() : watcher!.close())
        await ctx.watcherService.closeAll()
        trace.push('shutdown-complete')
      })()
      release.resolve()
      await Promise.all([shutdown, ...mocks.restarts])
      const resources = {
        rollupWatchers: ctx.watcherService.rollupWatcherMap.size,
        sidecarWatchers: ctx.watcherService.sidecarWatcherMap.size,
        openProviders: providers.filter(provider => provider.close.mock.calls.length === 0).length,
      }
      expect(mocks.forbiddenIo).not.toHaveBeenCalled()
      expect(mocks.logger.error).not.toHaveBeenCalled()
      expect(resources, trace.join(' -> ')).toEqual({ rollupWatchers: 0, sidecarWatchers: 0, openProviders: 0 })
    }
    finally {
      release.resolve()
      await Promise.allSettled(mocks.restarts)
      for (const controller of controllers) {
        await controller.watcher.close()
      }
      await ctx.watcherService.closeAll()
      controllerSpy.mockRestore()
    }
  })
})
