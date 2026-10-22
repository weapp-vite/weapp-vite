import type { RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { createDevBuildWatcher } from './devBuildWatcher'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin, deferWatcherResourceCleanup } from '../watcherPlugin'
import { createBuildService } from './service'

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  provider: vi.fn(),
  watch: vi.fn(),
  assets: vi.fn(),
  logger: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() },
  restarts: [] as Promise<void>[],
  forbiddenIo: vi.fn((operation: string) => {
    throw new Error(`Pure mock regression attempted real IO: ${operation}`)
  }),
}))

vi.mock('vite', () => ({ build: mocks.build }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('../../moduleGraph/devProvider', () => ({ createDevModuleGraphProvider: mocks.provider }))
vi.mock('../watch/assets', () => ({ watchAssetSources: mocks.assets }))
vi.mock('../../context/shared', () => ({ debug: vi.fn(), logger: mocks.logger }))
vi.mock('node:fs/promises', () => ({
  appendFile: (...args: unknown[]) => mocks.forbiddenIo(`appendFile:${args[0]}`),
  mkdir: (...args: unknown[]) => mocks.forbiddenIo(`mkdir:${args[0]}`),
}))
vi.mock('@weapp-core/shared/fs', () => ({
  fs: new Proxy({}, { get: (_target, key) => () => mocks.forbiddenIo(`fs.${String(key)}`) }),
}))
vi.mock('@weapp-core/shared/node', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-core/shared/node')>(),
  fs: new Proxy({}, { get: (_target, key) => () => mocks.forbiddenIo(`fs.${String(key)}`) }),
}))
vi.mock('./outputs', () => ({
  shouldCleanOutputs: () => false,
  cleanOutputs: () => mocks.forbiddenIo('cleanOutputs'),
  resetEmittedOutputCaches: vi.fn(),
  isOutputRootInsideOutDir: () => true,
}))
vi.mock('../sharedBuildConfig', () => ({ createSharedBuildConfig: () => ({}) }))
vi.mock('../supportFiles', () => ({
  syncProjectSupportFiles: async () => ({ managedTsconfigWarnings: [] }),
}))
vi.mock('../../utils/projectConfig', () => ({
  disableProjectPrivateConfigHotReload: () => mocks.forbiddenIo('project private config'),
  syncProjectConfigToOutput: () => mocks.forbiddenIo('project output config'),
}))
vi.mock('./workers', () => ({
  checkWorkersOptions: () => ({ hasWorkersDir: false }),
}))
vi.mock('./touchAppWxss', () => ({
  resolveTouchAppWxssEnabled: () => false,
  touchExistingAppStyle: () => mocks.forbiddenIo('touch app style'),
}))
vi.mock('./independent', () => ({
  createIndependentBuilder: () => ({
    buildIndependentBundle: () => mocks.forbiddenIo('independent build'),
    getIndependentOutput: () => undefined,
    invalidateIndependentOutput: vi.fn(),
  }),
}))
vi.mock('./pluginProject', () => ({
  assertPluginProjectOutput: vi.fn(),
  setPluginProjectBuildOptions: vi.fn(),
  createPluginProjectSession: () => mocks.forbiddenIo('plugin project session'),
  isPluginProjectClosing: () => false,
  // 普通 app 没有插件 CompilerSession，正式实现直接调用 restart；这里仅登记任务以确定完成边界。
  runPluginProjectRestart: (_ctx: unknown, restart: () => Promise<void>) => {
    const task = restart()
    mocks.restarts.push(task)
    return task
  },
}))
vi.mock('../statefulHmr/session', () => ({
  prepareStatefulClassicHandoff: () => mocks.forbiddenIo('stateful classic handoff'),
  runStatefulHmrDev: () => mocks.forbiddenIo('stateful dev'),
}))
vi.mock('../statefulHmr/snapshotBuild', () => ({
  buildStatefulHmrSnapshot: () => mocks.forbiddenIo('stateful snapshot'),
}))

function createContext() {
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      inlineConfig: {},
      weappViteConfig: { hmr: { runtime: 'classic' } },
      loadOptions: { cwd: '/project', isDev: true, mode: 'development' },
      load: vi.fn(async () => {}),
      merge: vi.fn((_meta: unknown, _inline: unknown, next: unknown) => next ?? {}),
      outDir: '/project/dist',
      outputExtensions: { wxss: 'wxss' },
      absoluteSrcRoot: '/project/src',
      relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
      relativeCwd: (id: string) => id.replace('/project/', ''),
      platform: 'weapp',
      multiPlatform: { enabled: false },
      packageJson: {},
      cwd: '/project',
      projectPrivateConfig: {},
      isDev: true,
      configFileDependencies: [],
    },
    npmService: { build: () => mocks.forbiddenIo('npm build') },
    scanService: {
      subPackageMap: new Map(),
      markDirty: vi.fn(),
      loadAppEntry: vi.fn(async () => {}),
      loadSubPackages: vi.fn(() => []),
      drainIndependentDirtyRoots: () => [],
    },
    moduleGraphService: {
      bindBuildContext: vi.fn(),
      bindPluginContext: vi.fn(),
      clearPendingChanges: vi.fn(),
      resetSession: vi.fn(),
      removeEntryDependencies: vi.fn(),
      collectAffectedEntries: () => new Set<string>(),
      hasModule: () => false,
      isLogicalLayoutEntry: () => false,
      recordChangedFile: vi.fn(),
    },
  }
  createWatcherServicePlugin(ctx as unknown as MutableCompilerContext)
  return ctx as typeof ctx & { watcherService: NonNullable<MutableCompilerContext['watcherService']> }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  mocks.restarts.length = 0
})

describe('classic config restart teardown ownership', () => {
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
    await sidecarEntered.promise
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
      await publications[0]!.promise
      await Promise.all(mocks.restarts)
      service.requestConfigRestart('app')
      controllers[1]!.emitEvent({ code: 'END' })
      await publications[1]!.promise
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

  it.each(['config-load', 'initial-publication'] as const)('does not leave a new generation after shutdown during %s', async (checkpoint) => {
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
      await entered.promise
      trace.push('shutdown-started')
      const shutdown = (async () => {
        await watcher!.close()
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
