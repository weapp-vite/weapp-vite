import type { RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin } from '../watcherPlugin'
import { createBuildService } from './service'

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  provider: vi.fn(),
  watch: vi.fn(),
  assets: vi.fn(),
  stateful: vi.fn(),
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
  syncProjectConfigToOutput: vi.fn(async () => {}),
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
  prepareStatefulClassicHandoff: vi.fn(),
  runStatefulHmrDev: mocks.stateful,
}))
vi.mock('../statefulHmr/snapshotBuild', () => ({
  buildStatefulHmrSnapshot: async () => ({ output: [], entryIds: [] }),
  prepareStatefulHmrSnapshot: (snapshot: unknown) => snapshot,
}))

vi.mock('../classicIdeConfig/prepare', () => ({ prepareClassicIdeConfig: vi.fn(async () => {}) }))

function createContext() {
  const root = path.resolve('virtual-handoff-fixture')
  const srcRoot = path.join(root, 'src')
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      inlineConfig: {},
      weappViteConfig: { hmr: { runtime: 'stateful-experimental' } },
      loadOptions: { cwd: root, isDev: true, mode: 'development' },
      load: vi.fn(async () => {}),
      merge: vi.fn((_meta: unknown, _inline: unknown, next: unknown) => next ?? {}),
      outDir: path.join(root, 'dist'),
      outputExtensions: { wxss: 'wxss' },
      absoluteSrcRoot: srcRoot,
      relativeAbsoluteSrcRoot: (id: string) => path.relative(srcRoot, id),
      relativeCwd: (id: string) => path.relative(root, id),
      platform: 'weapp',
      multiPlatform: { enabled: false },
      packageJson: {},
      cwd: root,
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

describe('stateful classic handoff shutdown ownership', () => {
  it.each(['complete', 'failed'].flatMap(outcome => ['service', 'facade'].map(entry => ({ outcome, entry }))))('finishes $entry shutdown while a $outcome classic publication enters ownership', async ({ outcome, entry }) => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const ctx = createContext()
    const failure = new Error('classic publication failed')
    const publication = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const statefulClose = vi.fn(async () => {})
    const providerClose = vi.fn(async () => {})
    const sidecarClose = vi.fn(async () => {})
    const assetClose = vi.fn(async () => {})
    mocks.stateful.mockResolvedValue({ close: statefulClose })
    mocks.provider.mockResolvedValue({ close: providerClose })
    mocks.watch.mockReturnValue({ add: vi.fn(), on: vi.fn(), close: sidecarClose })
    mocks.assets.mockReturnValue({ ready: Promise.resolve(), close: assetClose })
    mocks.build.mockImplementation(async () => {
      publication.resolve()
      await release.promise
      if (outcome === 'failed') {
        throw failure
      }
      return { output: [] }
    })
    const watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
    getHmrRuntimeSession(ctx).requestClassic({ code: 'config-json', message: 'template registration changed' })
    await publication.promise
    // 原生写出已可观察，后续 classic 控制器尚未登记；EOF 可以从外部异步链到达。
    let closed = false
    const closing = Promise.resolve(entry === 'service' ? ctx.watcherService.closeAll() : watcher.close())
    void closing.then(() => {
      closed = true
    }, () => {
      closed = true
    })
    const expectedClose = outcome === 'failed' ? expect(closing).rejects.toBe(failure) : closing
    await Promise.resolve()
    expect(closed).toBe(false)
    release.resolve()
    await vi.waitFor(() => expect(closed).toBe(true), { timeout: 1000 })
    await expectedClose
    if (outcome === 'failed') {
      await expect(watcher.close()).rejects.toBe(failure)
    }
    else {
      await watcher.close()
    }
    expect(statefulClose).toHaveBeenCalledOnce()
    expect(providerClose).toHaveBeenCalledOnce()
    // 当前启动模型先完成源监听器扫描，再进入首个发布；发布失败仍须释放已经取得的监听器。
    expect(sidecarClose).toHaveBeenCalledOnce()
    expect(assetClose).toHaveBeenCalledTimes(outcome === 'failed' ? 0 : 1)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(mocks.forbiddenIo).not.toHaveBeenCalled()
  })

  it('keeps an external facade close joined to a service-first drain after local cleanup finishes', async () => {
    vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
    const ctx = createContext()
    mocks.stateful.mockResolvedValue({ close: vi.fn(async () => {}) })
    const watcher = await createBuildService(ctx as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
    const localClosed = Promise.withResolvers<void>()
    ctx.moduleGraphService.resetSession.mockImplementation(() => {
      localClosed.resolve()
    })
    const web = Promise.withResolvers<void>()
    const failure = new Error('independent web cleanup failed')
    ;(ctx as unknown as MutableCompilerContext).webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    const serviceClose = ctx.watcherService.closeAll()
    const publicClose = watcher.close()
    const settled = Promise.allSettled([serviceClose, publicClose])
    let completed = false
    void settled.then(() => {
      completed = true
    })
    await localClosed.promise
    await Promise.resolve()
    expect(completed).toBe(false)
    expect(watcher.close()).toBe(publicClose)
    web.reject(failure)
    expect(await settled).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ])
    expect(mocks.forbiddenIo).not.toHaveBeenCalled()
  })
})
