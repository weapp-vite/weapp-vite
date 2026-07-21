import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupportedMiniProgramPlatforms } from '../../platform'

import { createRuntimeState } from '../runtimeState'
import { createBuildService } from './service'

const ALL_MP_PLATFORMS = [...getSupportedMiniProgramPlatforms()]

const buildMock = vi.hoisted(() => vi.fn())
const cleanOutputsMock = vi.hoisted(() => vi.fn(async () => {}))
const resetEmittedOutputCachesMock = vi.hoisted(() => vi.fn())
const isOutputRootInsideOutDirMock = vi.hoisted(() => vi.fn((outDir: string, pluginOutputRoot: string) => {
  return pluginOutputRoot === outDir || pluginOutputRoot.startsWith(`${outDir}/`)
}))
const createCompilerContextMock = vi.hoisted(() => vi.fn(async () => ({
  buildService: {
    build: vi.fn(async () => ({ output: [] })),
  },
  watcherService: {
    closeAll: vi.fn(),
  },
})))
const syncProjectConfigToOutputMock = vi.hoisted(() => vi.fn(async () => {}))
const generateLibDtsMock = vi.hoisted(() => vi.fn(async () => {}))
const createSharedBuildConfigMock = vi.hoisted(() => vi.fn(() => ({ shared: true })))
const resolveTouchAppWxssEnabledMock = vi.hoisted(() => vi.fn(() => true))
const touchMock = vi.hoisted(() => vi.fn(async () => {}))
const checkWorkersOptionsMock = vi.hoisted(() => vi.fn())
const devWorkersMock = vi.hoisted(() => vi.fn(async () => {}))
const watchWorkersMock = vi.hoisted(() => vi.fn())
const buildWorkersMock = vi.hoisted(() => vi.fn(async () => {}))
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const independentBuildMock = vi.hoisted(() => vi.fn(async () => ({ output: [] })))
const independentGetOutputMock = vi.hoisted(() => vi.fn(() => undefined))
const independentInvalidateMock = vi.hoisted(() => vi.fn())
const createIndependentBuilderMock = vi.hoisted(() => vi.fn(() => ({
  buildIndependentBundle: independentBuildMock,
  getIndependentOutput: independentGetOutputMock,
  invalidateIndependentOutput: independentInvalidateMock,
})))
const appendFileMock = vi.hoisted(() => vi.fn(async () => {}))
const mkdirMock = vi.hoisted(() => vi.fn(async () => {}))
const chokidarWatchMock = vi.hoisted(() => vi.fn(() => ({
  on: vi.fn(),
  close: vi.fn(),
})))
const syncProjectSupportFilesMock = vi.hoisted(() => vi.fn(async () => ({
  managedTsconfigChanged: false,
  managedTsconfigWarnings: [],
})))
const runStatefulHmrDevMock = vi.hoisted(() => vi.fn())
const devBuildWatcherQueue = vi.hoisted(() => [] as Array<{
  watcher: any
  emitEvent: ReturnType<typeof vi.fn>
}>)
const createDevBuildWatcherMock = vi.hoisted(() => vi.fn(() => {
  const queued = devBuildWatcherQueue.shift()
  if (queued) {
    return queued
  }
  const watcher = {
    on: vi.fn(() => watcher),
    off: vi.fn(() => watcher),
    clear: vi.fn(),
    close: vi.fn(async () => {}),
  }
  return { watcher, emitEvent: vi.fn() }
}))
const moduleGraphProviderChange = vi.hoisted(() => ({
  handler: undefined as undefined | ((file: string) => void),
}))
const createDevModuleGraphProviderMock = vi.hoisted(() => vi.fn(async (_ctx, _config, onChange) => {
  moduleGraphProviderChange.handler = onChange
  return { close: vi.fn(async () => {}) }
}))

vi.mock('node:fs/promises', () => ({
  appendFile: appendFileMock,
  mkdir: mkdirMock,
}))

vi.mock('vite', () => ({
  build: buildMock,
}))

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarWatchMock,
  },
}))

vi.mock('./outputs', () => ({
  cleanOutputs: cleanOutputsMock,
  isOutputRootInsideOutDir: isOutputRootInsideOutDirMock,
  resetEmittedOutputCaches: resetEmittedOutputCachesMock,
}))

vi.mock('../../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('../../utils/projectConfig', () => ({
  syncProjectConfigToOutput: syncProjectConfigToOutputMock,
}))

vi.mock('../supportFiles', () => ({
  syncProjectSupportFiles: syncProjectSupportFilesMock,
}))

vi.mock('../statefulHmr/session', () => ({
  runStatefulHmrDev: runStatefulHmrDevMock,
}))

vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: createDevModuleGraphProviderMock,
}))

vi.mock('./devBuildWatcher', () => ({
  createDevBuildWatcher: createDevBuildWatcherMock,
}))

vi.mock('../libDts', () => ({
  generateLibDts: generateLibDtsMock,
}))

vi.mock('../sharedBuildConfig', () => ({
  createSharedBuildConfig: createSharedBuildConfigMock,
}))

vi.mock('./touchAppWxss', () => ({
  resolveTouchAppWxssEnabled: resolveTouchAppWxssEnabledMock,
}))

vi.mock('./workers', () => ({
  checkWorkersOptions: checkWorkersOptionsMock,
  devWorkers: devWorkersMock,
  watchWorkers: watchWorkersMock,
  buildWorkers: buildWorkersMock,
}))

vi.mock('../../utils/file', () => ({
  touch: touchMock,
}))

vi.mock('../../context/shared', () => ({
  debug: vi.fn(),
  logger: {
    error: loggerErrorMock,
    info: loggerInfoMock,
    success: loggerSuccessMock,
    warn: loggerWarnMock,
  },
}))

vi.mock('./independent', () => ({
  createIndependentBuilder: createIndependentBuilderMock,
}))

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_VITEST = process.env.VITEST
const ORIGINAL_HMR_PROFILE_JSON = process.env.WEAPP_VITE_HMR_PROFILE_JSON

function createWatcher(eventCodes: string[]) {
  const watcher: any = {
    on: vi.fn((event: string, callback: (payload: { code: string }) => void) => {
      if (event === 'event') {
        queueMicrotask(() => {
          for (const code of eventCodes) {
            callback({ code })
          }
        })
      }
      return watcher
    }),
    close: vi.fn(),
  }
  return watcher
}

function createManualWatcher() {
  let eventCallback: ((payload: { code: string }) => void) | undefined
  let resolveSubscribed: (() => void) | undefined
  const subscribed = new Promise<void>((resolve) => {
    resolveSubscribed = resolve
  })
  const watcher: any = {
    on: vi.fn((event: string, callback: (payload: { code: string }) => void) => {
      if (event === 'event') {
        eventCallback = callback
        resolveSubscribed?.()
      }
      return watcher
    }),
    emit(code: string) {
      eventCallback?.({ code })
    },
    emitPayload(payload: { code: string, [key: string]: any }) {
      eventCallback?.(payload)
    },
    subscribed,
    close: vi.fn(),
  }
  devBuildWatcherQueue.push({
    watcher,
    emitEvent: vi.fn(event => watcher.emitPayload(event)),
  })
  return watcher
}

function createManualSidecarWatcher() {
  let allCallback: ((event: string, id?: string) => void) | undefined
  const watcher: any = {
    on: vi.fn((event: string, callback: (event: string, id?: string) => void) => {
      if (event === 'all') {
        allCallback = callback
      }
      return watcher
    }),
    emit(event: string, id?: string) {
      allCallback?.(event, id)
    },
    close: vi.fn(),
  }
  return watcher
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  const runtimeState = createRuntimeState()
  const rollupWatcherMap = new Map()
  const sidecarWatcherMap = new Map()
  const ctx = {
    runtimeState,
    configService: {
      weappViteConfig: {},
      weappLibConfig: undefined,
      loadOptions: {
        cwd: '/project',
        isDev: true,
        mode: 'development',
      },
      load: vi.fn(async () => {}),
      merge: vi.fn((_meta: any, _inline: any, next: any) => next ?? {}),
      outDir: '/project/dist',
      outputExtensions: { wxss: 'wxss' },
      absolutePluginRoot: undefined,
      absoluteSrcRoot: '/project/src',
      relativeAbsoluteSrcRoot: vi.fn((id: string) => id.replace('/project/src/', '')),
      relativeCwd: vi.fn((id: string) => id.replace('/project/', '')),
      platform: 'weapp',
      multiPlatform: {
        enabled: false,
        projectConfigRoot: 'config',
        targets: ALL_MP_PLATFORMS,
      },
      packageJson: {},
      cwd: '/project',
      projectConfigPath: '/project/project.config.json',
      projectPrivateConfigPath: '/project/project.private.config.json',
      isDev: true,
      configFileDependencies: [],
    },
    watcherService: {
      rollupWatcherMap,
      sidecarWatcherMap,
      setRollupWatcher: vi.fn((watcher: any, root: string = '/') => {
        rollupWatcherMap.set(root, watcher)
      }),
    },
    npmService: {
      build: vi.fn(async () => {}),
      checkDependenciesCacheOutdate: vi.fn(async () => true),
    },
    scanService: {
      workersDir: undefined,
      loadAppEntry: vi.fn(async () => {}),
      loadSubPackages: vi.fn(() => []),
    },
    moduleGraphService: {
      collectAffectedEntries: vi.fn(() => new Set<string>()),
      hasModule: vi.fn(() => true),
      isLogicalLayoutEntry: vi.fn(() => false),
      recordChangedFile: vi.fn(),
    },
  } as any

  if (Object.keys(overrides).length > 0) {
    Object.assign(ctx, overrides)
  }

  return ctx
}

async function flushAsyncTasks() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve()
  }
}

async function waitForTimers(ms = 12) {
  await new Promise(resolve => setTimeout(resolve, ms))
  await flushAsyncTasks()
}

async function waitForMockCalls(mock: { mock: { calls: unknown[] } }, count: number) {
  for (let index = 0; index < 20; index += 1) {
    if (mock.mock.calls.length >= count) {
      return
    }
    await flushAsyncTasks()
    await waitForTimers()
  }
}

describe('runtime buildPlugin service', () => {
  beforeEach(() => {
    devBuildWatcherQueue.length = 0
    vi.clearAllMocks()
    buildMock.mockReset()
    runStatefulHmrDevMock.mockReset()
    resetEmittedOutputCachesMock.mockReset()
    isOutputRootInsideOutDirMock.mockImplementation((outDir: string, pluginOutputRoot: string) => {
      return pluginOutputRoot === outDir || pluginOutputRoot.startsWith(`${outDir}/`)
    })
    process.env.VITEST = 'true'
    process.env.NODE_ENV = 'test'
    checkWorkersOptionsMock.mockReturnValue({
      hasWorkersDir: false,
      workersDir: undefined,
    })
    syncProjectSupportFilesMock.mockResolvedValue({
      managedTsconfigChanged: false,
      managedTsconfigWarnings: [],
    })
    chokidarWatchMock.mockClear()
    delete process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS
    delete process.env.WEAPP_VITE_HMR_PROFILE_JSON
  })

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    }
    else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV
    }
    if (ORIGINAL_VITEST === undefined) {
      delete process.env.VITEST
    }
    else {
      process.env.VITEST = ORIGINAL_VITEST
    }
    if (ORIGINAL_HMR_PROFILE_JSON === undefined) {
      delete process.env.WEAPP_VITE_HMR_PROFILE_JSON
    }
    else {
      process.env.WEAPP_VITE_HMR_PROFILE_JSON = ORIGINAL_HMR_PROFILE_JSON
    }
  })

  it('throws when required runtime services are missing', () => {
    const runtimeState = createRuntimeState()

    expect(() => createBuildService({ runtimeState } as any)).toThrow('构建服务需要先初始化 config、watcher、npm 和 scan 服务。')
  })

  it('seeds complete outputs before stateful dev and recreates the plugin graph on full reload', async () => {
    const firstWatcher = { close: vi.fn(async () => {}) }
    const secondWatcher = { close: vi.fn(async () => {}) }
    buildMock.mockResolvedValue({ output: [] })
    runStatefulHmrDevMock
      .mockResolvedValueOnce(firstWatcher)
      .mockResolvedValueOnce(secondWatcher)
    const ctx = createMockContext()
    ctx.configService.weappViteConfig.hmr = { runtime: 'stateful-experimental' }
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(runStatefulHmrDevMock).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    const restart = runStatefulHmrDevMock.mock.calls[0]![2]

    await restart()

    expect(firstWatcher.close).toHaveBeenCalledOnce()
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(runStatefulHmrDevMock).toHaveBeenCalledTimes(2)
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(3)
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenLastCalledWith(secondWatcher, '/')
  })

  it('runs dev app build with workers and caches touchAppWxss auto decision', async () => {
    process.env.VITEST = 'false'
    delete process.env.NODE_ENV

    const watcher = createManualWatcher()
    checkWorkersOptionsMock.mockReturnValue({
      hasWorkersDir: true,
      workersDir: 'workers',
    })
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    buildMock
      .mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build()
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    watcher.emit('START')
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['style-sidecar:1']
    watcher.emit('END')
    await waitForMockCalls(touchMock, 1)

    expect(process.env.NODE_ENV).toBe('development')
    expect(cleanOutputsMock).toHaveBeenCalledTimes(1)
    expect(syncProjectConfigToOutputMock).toHaveBeenCalledWith({
      outDir: '/project/dist',
      projectConfigPath: '/project/project.config.json',
      projectPrivateConfigPath: '/project/project.private.config.json',
      enabled: false,
    })
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.npmBuilt).toBe(true)
    expect(devWorkersMock).toHaveBeenCalledWith(ctx.configService, ctx.watcherService, 'workers')
    expect(watchWorkersMock).toHaveBeenCalledTimes(1)
    expect(resolveTouchAppWxssEnabledMock).toHaveBeenCalledTimes(1)
    expect(touchMock).toHaveBeenCalledWith('/project/dist/app.wxss')
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenCalledWith(expect.any(Object), '/')
  })

  it('touches app wxss for Tailwind content hmr updates', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['tailwind-content:1']
    watcher.emit('START')
    watcher.emit('END')
    await waitForMockCalls(touchMock, 1)

    expect(resolveTouchAppWxssEnabledMock).toHaveBeenCalledTimes(1)
    expect(touchMock).toHaveBeenCalledWith('/project/dist/app.wxss')
  })

  it('does not touch app wxss for shared css importer hmr updates in auto mode', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['css-importer:4']
    watcher.emit('START')
    watcher.emit('END')
    await flushAsyncTasks()

    expect(resolveTouchAppWxssEnabledMock).not.toHaveBeenCalled()
    expect(touchMock).not.toHaveBeenCalled()
  })

  it('does not touch app wxss for script-only hmr updates in auto mode', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-direct:1']
    watcher.emit('START')
    watcher.emit('END')
    await flushAsyncTasks()

    expect(resolveTouchAppWxssEnabledMock).not.toHaveBeenCalled()
    expect(touchMock).not.toHaveBeenCalled()
  })

  it('keeps explicit touchAppWxss true behavior for script-only hmr updates', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    ctx.configService.weappViteConfig = {
      hmr: {
        touchAppWxss: true,
      },
    }
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await buildPromise

    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-direct:1']
    watcher.emit('START')
    watcher.emit('END')
    await waitForMockCalls(touchMock, 1)

    expect(resolveTouchAppWxssEnabledMock).not.toHaveBeenCalled()
    expect(touchMock).toHaveBeenCalledWith('/project/dist/app.wxss')
  })

  it('forces dev watch builds to keep writing files to outDir', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
      build: expect.objectContaining({
        write: true,
      }),
    }))
  })

  it('does not run an extra snapshot write build after regular dev watch end events', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    expect(buildMock).toHaveBeenCalledTimes(1)
  })

  it('runs sidecar snapshot build with its own hmr timing window', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([
      '/project/src/pages/logs/index.ts',
    ]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    nowValue = 20
    moduleGraphProviderChange.handler?.('/project/src/pages/logs/index.wxml')
    nowValue = 28
    await waitForMockCalls(loggerSuccessMock, 1)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('8.00 ms'))
    nowSpy.mockRestore()
  })

  it('runs a stable narrow metadata snapshot build for direct sidecar updates', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const forceFullValues: Array<string | undefined> = []
    const dirtySummaries: Array<string[] | undefined> = []
    const ctx = createMockContext()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        forceFullValues.push(process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS)
        dirtySummaries.push(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)
        return { output: [] }
      })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/about/index.ts', {
      id: '/project/src/pages/about/index.ts',
    })
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/logs/index.ts')
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/about/index.ts')
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([
      '/project/src/pages/logs/index.ts',
    ]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild
    touchMock.mockClear()

    moduleGraphProviderChange.handler?.('/project/src/pages/logs/index.wxml')
    await waitForMockCalls(buildMock, 2)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      build: expect.objectContaining({ emptyOutDir: false }),
    }))
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set(['/project/src/pages/logs/index.ts']))
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get('/project/src/pages/logs/index.ts')).toBe('metadata')
    expect(dirtySummaries).toEqual([['sidecar-direct:1']])
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.has('/project/src/pages/logs/index.ts')).toBe(false)
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.has('/project/src/pages/about/index.ts')).toBe(true)
    expect(touchMock).not.toHaveBeenCalled()
    expect(loggerSuccessMock).toHaveBeenCalled()
    expect(forceFullValues).toEqual([undefined])
  })

  it('batches consecutive sidecar snapshot events into one build', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const dirtySummaries: Array<string[] | undefined> = []
    const forceFullValues: Array<string | undefined> = []
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    const ctx = createMockContext()
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/about/index.ts', {
      id: '/project/src/pages/about/index.ts',
    })
    ctx.moduleGraphService.collectAffectedEntries.mockImplementation((file: string) => {
      return new Set([
        file.endsWith('.wxml')
          ? '/project/src/pages/logs/index.ts'
          : '/project/src/pages/about/index.ts',
      ])
    })
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        dirtySummaries.push(ctx.runtimeState.build.hmr.profile.dirtyReasonSummary)
        forceFullValues.push(process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS)
        return { output: [] }
      })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    moduleGraphProviderChange.handler?.('/project/src/pages/logs/index.wxml')
    moduleGraphProviderChange.handler?.('/project/src/pages/about/index.wxss')
    await waitForMockCalls(buildMock, 2)

    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([
      '/project/src/pages/logs/index.ts',
      '/project/src/pages/about/index.ts',
    ]))
    expect(dirtySummaries).toEqual([['sidecar-direct:1', 'style-sidecar:1']])
    expect(forceFullValues).toEqual([undefined])
    expect(loggerSuccessMock).toHaveBeenCalledTimes(1)
  })

  it('keeps full snapshot fallback for sidecar topology changes', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const forceFullValues: Array<string | undefined> = []
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockImplementation(async () => {
        forceFullValues.push(process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS)
        return { output: [] }
      })
    const ctx = createMockContext()
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/about/index.ts', {
      id: '/project/src/pages/about/index.ts',
    })
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/logs/index.ts')
    ctx.runtimeState.build.hmr.loadedEntrySet.add('/project/src/pages/about/index.ts')
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([
      '/project/src/pages/logs/index.ts',
    ]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('add', '/project/src/pages/logs/index.wxml')
    await waitForMockCalls(buildMock, 2)

    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([
      '/project/src/pages/logs/index.ts',
      '/project/src/pages/about/index.ts',
    ]))
    expect(ctx.runtimeState.build.hmr.loadedEntrySet.size).toBe(0)
    expect(forceFullValues).toEqual(['1'])
    expect(buildMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      build: expect.objectContaining({ emptyOutDir: true }),
    }))
  })

  it('ignores vue updates in snapshot sidecar watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('change', '/project/src/pages/logs/index.vue')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).not.toHaveBeenCalled()
  })

  it('ignores plain script updates in snapshot sidecar watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('change', '/project/src/shared/runtime-dep.ts')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).not.toHaveBeenCalled()
  })

  it('routes native logical layout scripts through the dev graph provider', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const layoutId = '/project/src/layouts/default/index.ts'
    const pageId = '/project/src/pages/layouts/index.ts'
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(pageId, { id: pageId })
    ctx.moduleGraphService.isLogicalLayoutEntry.mockImplementation((id: string) => id === layoutId)
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(layoutId, { id: layoutId })
    ctx.moduleGraphService.collectAffectedEntries.mockReturnValue(new Set([layoutId, pageId]))
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    moduleGraphProviderChange.handler?.(layoutId)
    await waitForMockCalls(buildMock, 2)

    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set([layoutId, pageId]))
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get(layoutId)).toBe('dependency')
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get(pageId)).toBe('dependency')
  })

  it('leaves existing linked script updates to the Rolldown watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.configService.inlineConfig = {
      build: {
        watch: {
          include: ['/workspace/packages/shared/**'],
        },
      },
    }
    ctx.runtimeState.build.hmr.resolvedEntryMap.set('/project/src/pages/logs/index.ts', {
      id: '/project/src/pages/logs/index.ts',
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    const [patterns] = chokidarWatchMock.mock.calls[0]!
    expect(patterns).toContain('/workspace/packages/shared/**')

    sidecarWatcher.emit('change', '/workspace/packages/shared/message.ts')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet).toEqual(new Set())
  })

  it('ignores generated output updates in snapshot sidecar watcher', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    sidecarWatcher.emit('change', '/project/dist/pages/logs/index.wxml')
    await flushAsyncTasks()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).not.toHaveBeenCalled()
  })

  it('closes snapshot sidecar watcher when main watcher closes directly', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    const result = await firstBuild

    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(1)
    await result.close()

    expect(sidecarWatcher.close).toHaveBeenCalledTimes(1)
    expect(ctx.watcherService.sidecarWatcherMap.size).toBe(0)
    expect(ctx.watcherService.rollupWatcherMap.size).toBe(0)
  })

  it('restarts the dev watcher after config dependency changes request a restart', async () => {
    const watcher = createManualWatcher()
    const restartedWatcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    const restartedSidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock
      .mockReturnValueOnce(sidecarWatcher)
      .mockReturnValueOnce(restartedSidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce(restartedWatcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    const originalScanState = ctx.runtimeState.scan
    ctx.runtimeState.json.cache.set('/project/src/app.json', { stale: true })
    ctx.runtimeState.autoImport.registry.set('StaleComp', { kind: 'local', name: 'StaleComp', from: '/project/src/components/StaleComp/index' } as any)
    syncProjectSupportFilesMock.mockResolvedValueOnce({
      managedTsconfigChanged: true,
      managedTsconfigWarnings: ['srcRoot mismatch'],
    })

    service.requestConfigRestart('app')
    watcher.emit('START')
    watcher.emit('END')

    await restartedWatcher.subscribed
    restartedWatcher.emit('START')
    restartedWatcher.emit('END')
    await flushAsyncTasks()

    expect(sidecarWatcher.close).toHaveBeenCalledTimes(1)
    expect(ctx.configService.load).toHaveBeenCalledWith(ctx.configService.loadOptions)
    expect(syncProjectSupportFilesMock).toHaveBeenCalledWith(ctx)
    expect(loggerWarnMock).toHaveBeenCalledWith('srcRoot mismatch')
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.scan).toBe(originalScanState)
    expect(ctx.runtimeState.json.cache.get('/project/src/app.json')).toBeUndefined()
    expect(ctx.runtimeState.autoImport.registry.size).toBe(0)
    expect(buildMock).toHaveBeenCalledTimes(2)
    expect(ctx.watcherService.rollupWatcherMap.get('/')).toBe(restartedWatcher)
    expect(loggerInfoMock).toHaveBeenCalledWith('检测到 Vite 配置变更，正在重启小程序开发构建...')
    expect(loggerSuccessMock).not.toHaveBeenCalledWith(expect.stringContaining('小程序已重新构建'))
    expect(loggerSuccessMock).toHaveBeenCalledWith('Vite 配置已重新加载，小程序开发构建已重启。')
  })

  it('keeps the app entry scan error when config restart cannot reload entries', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const appEntryError = new Error('在 /project/src 目录下没有找到 `app.json`、`app.json.ts` 或 `app.vue`')
    ctx.scanService.loadAppEntry.mockRejectedValueOnce(appEntryError)
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    service.requestConfigRestart('app')
    watcher.emit('START')
    watcher.emit('END')

    await waitForMockCalls(ctx.scanService.loadAppEntry, 1)
    await flushAsyncTasks()
    expect(ctx.scanService.loadSubPackages).not.toHaveBeenCalled()
    expect(buildMock).toHaveBeenCalledTimes(1)
  })

  it('narrows snapshot sidecar watcher to sidecar globs and ignores generated roots', async () => {
    const watcher = createManualWatcher()
    const sidecarWatcher = createManualSidecarWatcher()
    chokidarWatchMock.mockReturnValue(sidecarWatcher)
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValue({ output: [] })
    const ctx = createMockContext()
    ctx.configService.absoluteSrcRoot = '/project'
    ctx.configService.outDir = '/project/dist'
    ctx.configService.mpDistRoot = 'dist'
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    const [patterns, options] = chokidarWatchMock.mock.calls[0]!
    expect(patterns).toEqual(expect.arrayContaining([
      '/project/**/*.json',
      '/project/**/*.wxml',
      '/project/**/*.wxss',
      '/project/**/*.wxs',
    ]))
    expect(patterns).not.toContain('/project')
    expect(options.ignored('/project/node_modules/tdesign-miniprogram/miniprogram_dist/button/button.wxml')).toBe(true)
    expect(options.ignored('/project/dist/pages/index/index.wxml')).toBe(true)
    expect(options.ignored('/project/.weapp-vite/components.d.ts')).toBe(true)
    expect(options.ignored('/project/pages/index/index.wxml')).toBe(false)
  })

  it('prints hmr phase timings on rebuild completion and resets the profile', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      eventId: 'hmr-event-1',
      file: '/project/src/pages/logs/index.vue',
      event: 'update',
      buildStartMs: 4,
      pluginResolveMs: 2,
      transformMs: 9.5,
      coreTransformMs: 2.5,
      wevuTransformMs: 3,
      vueTransformMs: 4,
      writeMs: 5.25,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
      sharedChunkResolveMs: 1.75,
      entryChunkLoadMs: 6.5,
      entryChunkEmitFileMs: 0.75,
      chunkEmitCount: 3,
      loadCount: 2,
      resolveCount: 5,
      skippedLoadedCount: 1,
      dirtyCount: 2,
      pendingCount: 2,
      emittedCount: 2,
      dirtyReasonSummary: ['entry-direct:1', 'importer-graph:1'],
      pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
    }
    watcher.emit('START')
    watcher.emit('END')

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('小程序已重新构建（'))
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringMatching(/小程序已重新构建（\d+\.\d{2} ms）/))
    expect(ctx.runtimeState.build.hmr.profile).toEqual({})
  })

  it('tracks recent hmr samples and prints a rolling summary for rebuild trends', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    for (let index = 0; index < 6; index += 1) {
      ctx.runtimeState.build.hmr.profile = {
        watchToDirtyMs: 2 + index,
        emitMs: 10 + index,
        sharedChunkResolveMs: 1 + index,
        dirtyCount: 1,
        pendingCount: 2 + index,
        emittedCount: 1,
      }
      watcher.emit('START')
      watcher.emit('END')
    }

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledTimes(6)
    })
    expect(ctx.runtimeState.build.hmr.recentProfiles).toHaveLength(5)
    expect(loggerSuccessMock).toHaveBeenLastCalledWith(expect.stringMatching(/小程序已重新构建（\d+\.\d{2} ms）/))
  })

  it('prints concise hmr log when hmr.logLevel is concise', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(177.25)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            logLevel: 'concise',
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      buildCoreMs: 120.5,
      transformMs: 40.25,
      vueCompileMs: 12.5,
      vueFinalizeCodeMs: 2.25,
      writeMs: 6.5,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
    }
    watcher.emit('START')
    watcher.emit('END')

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('build-core '))
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('transform 40.25 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('vue-compile 12.50 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('vue-finalize-code 2.25 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('write 6.50 ms'))
    expect(loggerSuccessMock).not.toHaveBeenCalledWith(expect.stringContaining('watch->dirty'))
    expect(loggerSuccessMock).not.toHaveBeenCalledWith(expect.stringContaining('d/p/e'))
    nowSpy.mockRestore()
  })

  it('prints verbose hmr log only when hmr.logLevel is verbose', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(177)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(379)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            logLevel: 'verbose',
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    for (const profile of [
      {
        buildCoreMs: 40,
        transformMs: 10,
        vueCompileMs: 4,
        writeMs: 3,
        watchToDirtyMs: 2,
        emitMs: 8,
        sharedChunkResolveMs: 1,
        dirtyCount: 1,
        pendingCount: 2,
        emittedCount: 2,
        dirtyReasonSummary: ['entry-direct:1'],
        pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
      },
      {
        buildCoreMs: 42,
        transformMs: 11,
        vueCompileMs: 5,
        writeMs: 4,
        watchToDirtyMs: 3,
        emitMs: 9,
        sharedChunkResolveMs: 2,
        dirtyCount: 1,
        pendingCount: 2,
        emittedCount: 2,
        dirtyReasonSummary: ['entry-direct:1'],
        pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
      },
    ]) {
      ctx.runtimeState.build.hmr.profile = profile
      watcher.emit('START')
      watcher.emit('END')
    }

    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('build-core '))
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('transform 11.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('vue-compile 5.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('write 4.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('watch->dirty 3.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('d/p/e 1/2/2'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('cause entry -> shared+1'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('近2次 avg'))
    nowSpy.mockRestore()
  })

  it('writes hmr profile jsonl with default output path when enabled', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(100)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      eventId: 'hmr-event-1',
      file: '/project/src/pages/logs/index.vue',
      event: 'update',
      buildStartMs: 4,
      pluginResolveMs: 2,
      transformMs: 9.5,
      coreTransformMs: 2.5,
      wevuTransformMs: 3,
      vueTransformMs: 4,
      vueReadSourceMs: 0.5,
      vueCompileMs: 2,
      vueFinalizeCompiledMs: 0.75,
      vueFinalizeCodeMs: 0.75,
      coreLoadMs: 4,
      entryLoadMs: 2.5,
      requestGlobalsMs: 1,
      weapiResolveMs: 0.5,
      renderStartMs: 6,
      generateBundleMs: 11,
      generateSharedMs: 3,
      generateRewriteMs: 7,
      generateModuleGraphMs: 1,
      writeMs: 5.25,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
      sharedChunkResolveMs: 1.75,
      entryChunkLoadMs: 6.5,
      entryChunkEmitFileMs: 0.75,
      chunkEmitCount: 3,
      loadCount: 2,
      resolveCount: 5,
      skippedLoadedCount: 1,
      dirtyCount: 2,
      pendingCount: 2,
      emittedCount: 2,
      dirtyReasonSummary: ['entry-direct:1'],
      pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(appendFileMock).toHaveBeenCalledTimes(1)
    })

    expect(mkdirMock).toHaveBeenCalledWith('/project/.weapp-vite', { recursive: true })
    expect(appendFileMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/hmr-profile.jsonl',
      expect.stringMatching(/"file":"\/project\/src\/pages\/logs\/index\.vue"/),
      'utf8',
    )
    const [, payload] = appendFileMock.mock.calls[0]
    expect(typeof payload).toBe('string')
    expect(payload.endsWith('\n')).toBe(true)
    expect(payload).toContain('"event":"update"')
    expect(payload).toContain('"eventId":"hmr-event-1"')
    expect(payload).toContain('"relativeFile":"src/pages/logs/index.vue"')
    expect(payload).toContain('"sourceRootFile":"pages/logs/index.vue"')
    expect(payload).toContain('"buildStartMs":4')
    expect(payload).toContain('"pluginResolveMs":2')
    expect(payload).toContain('"transformMs":9.5')
    expect(payload).toContain('"coreTransformMs":2.5')
    expect(payload).toContain('"wevuTransformMs":3')
    expect(payload).toContain('"vueTransformMs":4')
    expect(payload).toContain('"vueReadSourceMs":0.5')
    expect(payload).toContain('"vueCompileMs":2')
    expect(payload).toContain('"vueFinalizeCompiledMs":0.75')
    expect(payload).toContain('"vueFinalizeCodeMs":0.75')
    expect(payload).toContain('"coreLoadMs":4')
    expect(payload).toContain('"entryLoadMs":2.5')
    expect(payload).toContain('"requestGlobalsMs":1')
    expect(payload).toContain('"weapiResolveMs":0.5')
    expect(payload).toContain('"renderStartMs":6')
    expect(payload).toContain('"generateBundleMs":11')
    expect(payload).toContain('"generateSharedMs":3')
    expect(payload).toContain('"generateRewriteMs":7')
    expect(payload).toContain('"generateModuleGraphMs":1')
    expect(payload).toContain('"bundlerMs":')
    expect(payload).toContain('"writeMs":5.25')
    expect(payload).toContain('"buildCoreMs":30.5')
    expect(payload).toContain('"entryChunkLoadMs":6.5')
    expect(payload).toContain('"entryChunkEmitFileMs":0.75')
    expect(payload).toContain('"chunkEmitCount":3')
    expect(payload).toContain('"loadCount":2')
    expect(payload).toContain('"resolveCount":5')
    expect(payload).toContain('"skippedLoadedCount":1')
    expect(payload).toContain('"dirtyReasonSummary":["entry-direct:1"]')
    expect(payload).toContain('"pendingReasonSummary":["shared-chunk(common.js)+1:direct"]')
    nowSpy.mockRestore()
  })

  it('writes hmr profile jsonl to custom relative path', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: '.reports/hmr.jsonl',
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      event: 'create',
      dirtyCount: 1,
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(appendFileMock).toHaveBeenCalledTimes(1)
    })

    expect(mkdirMock).toHaveBeenCalledWith('/project/.reports', { recursive: true })
    expect(appendFileMock).toHaveBeenCalledWith(
      '/project/.reports/hmr.jsonl',
      expect.stringContaining('"event":"create"'),
      'utf8',
    )
  })

  it('does not write hmr profile jsonl when disabled', async () => {
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      event: 'update',
      dirtyCount: 1,
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(loggerSuccessMock).toHaveBeenCalled()
    })

    expect(mkdirMock).not.toHaveBeenCalled()
    expect(appendFileMock).not.toHaveBeenCalled()
  })

  it('writes hmr profile jsonl when env flag enables output', async () => {
    process.env.WEAPP_VITE_HMR_PROFILE_JSON = '1'
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      event: 'update',
      dirtyCount: 1,
    }
    watcher.emit('START')
    watcher.emit('END')
    await vi.waitFor(() => {
      expect(appendFileMock).toHaveBeenCalledTimes(1)
    })

    expect(appendFileMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/hmr-profile.jsonl',
      expect.stringContaining('"event":"update"'),
      'utf8',
    )
  })

  it('prints analyze hint when hmr profile is enabled and rebuild becomes much slower', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    for (const totalMs of [100, 80, 90, 200]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      nowValue = cursor
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    await waitForMockCalls(loggerInfoMock, 1)
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('weapp-vite analyze --hmr-profile'))
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('当前 200.00 ms'))
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('疑似慢段 emit 100.00 ms'))
    nowSpy.mockRestore()
  })

  it('does not print analyze hint when hmr profile output is disabled', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    for (const totalMs of [100, 80, 90, 200]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      nowValue = cursor
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    expect(loggerInfoMock).not.toHaveBeenCalled()
    nowSpy.mockRestore()
  })

  it('suppresses repeated slow hmr hints until enough new samples accumulate', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    for (const totalMs of [100, 80, 90, 200, 210, 220]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      nowValue = cursor
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    expect(loggerInfoMock).toHaveBeenCalledTimes(1)
    nowSpy.mockRestore()
  })

  it('prefers shared phase hint when shared chunk cost regresses most', async () => {
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
    const watcher = createManualWatcher()
    buildMock
      .mockResolvedValueOnce(watcher)
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          hmr: {
            profileJson: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    nowValue = 0
    watcher.emit('START')
    nowValue = 10
    watcher.emit('END')
    await firstBuild

    let cursor = 20
    const durations = [100, 80, 90, 200]
    for (const { profile, totalMs } of [
      { emitMs: 20, sharedChunkResolveMs: 6 },
      { emitMs: 22, sharedChunkResolveMs: 7 },
      { emitMs: 24, sharedChunkResolveMs: 8 },
      { emitMs: 26, sharedChunkResolveMs: 90 },
    ].map((profile, index) => ({ profile, totalMs: durations[index] }))) {
      nowValue = cursor
      ctx.runtimeState.build.hmr.profile = profile
      watcher.emit('START')
      nowValue = cursor + totalMs
      watcher.emit('END')
      await waitForMockCalls(loggerSuccessMock, cursor === 20 ? 1 : loggerSuccessMock.mock.calls.length + 1)
      cursor += totalMs + 10
    }

    await waitForMockCalls(loggerInfoMock, 1)
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('疑似慢段 shared 90.00 ms'))
    nowSpy.mockRestore()
  })

  it('skips npm build when skipNpm is enabled and hmr touch is false', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        weappViteConfig: {
          hmr: {
            touchAppWxss: false,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(ctx.npmService.build).not.toHaveBeenCalled()
    expect(resolveTouchAppWxssEnabledMock).not.toHaveBeenCalled()
    expect(touchMock).not.toHaveBeenCalled()
  })

  it('skips output cleanup in dev when cleanOutputsInDev is false', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          cleanOutputsInDev: false,
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build()

    expect(cleanOutputsMock).not.toHaveBeenCalled()
    expect(syncProjectConfigToOutputMock).toHaveBeenCalledTimes(1)
  })

  it('runs project config sync concurrently with the dev bundler build', async () => {
    const watcher = createManualWatcher()
    let releaseProjectConfigSync: (() => void) | undefined
    syncProjectConfigToOutputMock.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        releaseProjectConfigSync = resolve
      })
    })
    buildMock.mockResolvedValueOnce(watcher)
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        multiPlatform: {
          ...baseCtx.configService.multiPlatform,
          enabled: true,
        },
      },
    })
    const service = createBuildService(ctx)

    const buildPromise = service.build({ skipNpm: true })
    await watcher.subscribed

    expect(syncProjectConfigToOutputMock).toHaveBeenCalledTimes(1)
    expect(buildMock).toHaveBeenCalledTimes(1)

    watcher.emit('START')
    watcher.emit('END')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(releaseProjectConfigSync).toBeDefined()

    let resolved = false
    buildPromise.then(() => {
      resolved = true
    }).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(resolved).toBe(false)

    releaseProjectConfigSync?.()
    await buildPromise
    expect(resolved).toBe(true)
  })

  it('cleans output in dev when cleanOutputsInDev is true', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        weappViteConfig: {
          cleanOutputsInDev: true,
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build()

    expect(cleanOutputsMock).toHaveBeenCalledTimes(1)
    expect(resetEmittedOutputCachesMock).toHaveBeenCalledWith(ctx.runtimeState)
  })

  it('reuses npm cache in dev mode when dependencies are not outdated', async () => {
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext()
    ctx.runtimeState.build.npmBuilt = true
    ctx.npmService.checkDependenciesCacheOutdate.mockResolvedValueOnce(false)
    const service = createBuildService(ctx)

    await service.build()

    expect(ctx.npmService.build).not.toHaveBeenCalled()
    expect(ctx.npmService.checkDependenciesCacheOutdate).toHaveBeenCalledTimes(1)
  })

  it('rejects dev build when the initial one-shot build fails', async () => {
    const buildError = new Error('initial build failed')
    buildMock.mockRejectedValueOnce(buildError)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    await expect(service.build({ skipNpm: true })).rejects.toBe(buildError)
    expect(ctx.watcherService.setRollupWatcher).not.toHaveBeenCalled()
  })

  it('runs prod app and plugin builds with workers and npm scheduling', async () => {
    process.env.VITEST = 'false'
    process.env.NODE_ENV = 'production'

    checkWorkersOptionsMock.mockImplementation((target: string) => {
      if (target === 'app') {
        return {
          hasWorkersDir: true,
          workersDir: 'workers',
        }
      }
      return {
        hasWorkersDir: false,
        workersDir: undefined,
      }
    })
    buildMock
      .mockResolvedValueOnce({ output: [] })
      .mockResolvedValueOnce({ output: [] })
    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        isDev: false,
        absolutePluginRoot: '/project/src/plugin',
        absolutePluginOutputRoot: '/project/dist-plugin',
        multiPlatform: {
          enabled: true,
          projectConfigRoot: 'config',
          targets: ALL_MP_PLATFORMS,
        },
        weappViteConfig: {
          multiPlatform: true,
        },
      },
    })
    const queueStartSpy = vi.spyOn(ctx.runtimeState.build.queue, 'start')
    const service = createBuildService(ctx)

    await service.build()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(buildMock).toHaveBeenNthCalledWith(1, {})
    expect(buildWorkersMock).toHaveBeenCalledTimes(1)
    expect(createCompilerContextMock).toHaveBeenCalledWith({
      key: 'plugin-build:/project',
      cwd: '/project',
      isDev: false,
      mode: undefined,
      pluginOnly: true,
      configFile: undefined,
      cliPlatform: 'weapp',
      projectConfigPath: '/project/project.config.json',
      inlineConfig: {
        build: {
          outDir: '/project/dist-plugin',
        },
      },
    })
    const isolatedCtx = await createCompilerContextMock.mock.results[0].value
    expect(isolatedCtx.buildService.build).toHaveBeenCalledWith(undefined)
    expect(queueStartSpy).toHaveBeenCalled()
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)
    expect(syncProjectConfigToOutputMock).toHaveBeenCalledWith({
      outDir: '/project/dist',
      projectConfigPath: '/project/project.config.json',
      projectPrivateConfigPath: '/project/project.private.config.json',
      enabled: true,
    })
  })

  it('runs prod bundler without waiting for local subpackage npm preload', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })
    let releaseNpmBuild: (() => void) | undefined

    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        isDev: false,
        weappViteConfig: {
          npm: {
            enable: true,
            subPackages: {
              packageA: {
                dependencies: ['dayjs'],
              },
            },
          },
        },
      },
    })
    ctx.npmService.build.mockImplementationOnce(async () => {
      await ctx.scanService.loadAppEntry()
      ctx.scanService.loadSubPackages()
      await new Promise<void>((resolve) => {
        releaseNpmBuild = resolve
      })
    })
    const service = createBuildService(ctx)

    const buildPromise = service.build()
    await waitForMockCalls(buildMock, 1)

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)

    let resolved = false
    buildPromise.then(() => {
      resolved = true
    }).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(resolved).toBe(false)

    releaseNpmBuild?.()
    await buildPromise
    expect(resolved).toBe(true)
  })

  it('preloads app entry before prod build when worker entry config needs workersDir', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

    const baseCtx = createMockContext()
    const ctx = createMockContext({
      configService: {
        ...baseCtx.configService,
        isDev: false,
        weappViteConfig: {
          worker: {
            entry: ['index'],
          },
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.npmService.build).not.toHaveBeenCalled()
  })

  it('runs isolated plugin watcher in dev mode and registers it on main watcher service', async () => {
    const pluginWatcher = createWatcher(['START', 'END'])
    buildMock.mockReset()
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce({ output: [] })
    createCompilerContextMock.mockResolvedValueOnce({
      buildService: {
        build: vi.fn(async () => pluginWatcher),
      },
      watcherService: {
        closeAll: vi.fn(),
      },
    })

    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        absolutePluginRoot: '/project/plugin',
        absolutePluginOutputRoot: '/project/dist-plugin',
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(createCompilerContextMock).toHaveBeenCalledWith({
      key: 'plugin-build:/project',
      cwd: '/project',
      isDev: true,
      mode: undefined,
      pluginOnly: true,
      configFile: undefined,
      cliPlatform: 'weapp',
      projectConfigPath: '/project/project.config.json',
      inlineConfig: {
        build: {
          outDir: '/project/dist-plugin',
        },
      },
    })
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenCalledWith(pluginWatcher, '/project/plugin')
  })

  it('runs prod lib build and emits dts without npm/project-config/plugin build', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

    const ctx = createMockContext({
      configService: {
        ...createMockContext().configService,
        isDev: false,
        absolutePluginRoot: '/project/src/plugin',
        weappLibConfig: {
          enabled: true,
          dts: {
            enabled: true,
          },
        },
      },
    })
    const service = createBuildService(ctx)

    await service.build()

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(generateLibDtsMock).toHaveBeenCalledWith(ctx.configService)
    expect(syncProjectConfigToOutputMock).not.toHaveBeenCalled()
    expect(ctx.npmService.build).not.toHaveBeenCalled()
  })

  it('runs plugin target directly in pluginOnly mode', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

    const ctx = createMockContext({
      currentBuildTarget: 'app',
      configService: {
        ...createMockContext().configService,
        isDev: false,
        pluginOnly: true,
      },
    })
    const service = createBuildService(ctx)

    await service.build({ skipNpm: true })

    expect(ctx.currentBuildTarget).toBe('plugin')
    expect(createCompilerContextMock).not.toHaveBeenCalled()
    expect(ctx.npmService.build).not.toHaveBeenCalled()
  })

  it('exposes independent builder methods from createIndependentBuilder', async () => {
    const ctx = createMockContext()
    const service = createBuildService(ctx)
    const meta = {
      subPackage: {
        root: 'pkg',
      },
    } as any

    await service.buildIndependentBundle('pkg', meta)
    service.getIndependentOutput('pkg')
    service.invalidateIndependentOutput('pkg')

    expect(independentBuildMock).toHaveBeenCalledWith('pkg', meta)
    expect(independentGetOutputMock).toHaveBeenCalledWith('pkg')
    expect(independentInvalidateMock).toHaveBeenCalledWith('pkg')
  })
})
