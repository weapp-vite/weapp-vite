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

vi.mock('node:fs/promises', () => ({
  appendFile: appendFileMock,
  mkdir: mkdirMock,
}))

vi.mock('vite', () => ({
  build: buildMock,
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
    info: loggerInfoMock,
    success: loggerSuccessMock,
  },
}))

vi.mock('./independent', () => ({
  createIndependentBuilder: createIndependentBuilderMock,
}))

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_VITEST = process.env.VITEST

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
    subscribed,
    close: vi.fn(),
  }
  return watcher
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
    configService: {
      weappViteConfig: {},
      weappLibConfig: undefined,
      merge: vi.fn((_meta: any, _inline: any, next: any) => next ?? {}),
      outDir: '/project/dist',
      outputExtensions: { wxss: 'wxss' },
      absolutePluginRoot: undefined,
      absoluteSrcRoot: '/project/src',
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
    },
    watcherService: {
      setRollupWatcher: vi.fn(),
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
  } as any

  if (Object.keys(overrides).length > 0) {
    Object.assign(ctx, overrides)
  }

  return ctx
}

describe('runtime buildPlugin service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })

  it('throws when required runtime services are missing', () => {
    const runtimeState = createRuntimeState()

    expect(() => createBuildService({ runtimeState } as any)).toThrow('构建服务需要先初始化 config、watcher、npm 和 scan 服务。')
  })

  it('runs dev app build with workers and caches touchAppWxss auto decision', async () => {
    process.env.VITEST = 'false'
    delete process.env.NODE_ENV

    checkWorkersOptionsMock.mockReturnValue({
      hasWorkersDir: true,
      workersDir: 'workers',
    })
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    buildMock
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
      .mockResolvedValueOnce(createWatcher(['START', 'END']))
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    await service.build()
    await service.build()

    expect(process.env.NODE_ENV).toBe('development')
    expect(cleanOutputsMock).toHaveBeenCalledTimes(2)
    expect(syncProjectConfigToOutputMock).toHaveBeenCalledWith({
      outDir: '/project/dist',
      projectConfigPath: '/project/project.config.json',
      projectPrivateConfigPath: '/project/project.private.config.json',
      enabled: false,
    })
    expect(ctx.npmService.build).toHaveBeenCalledTimes(2)
    expect(ctx.runtimeState.build.npmBuilt).toBe(true)
    expect(devWorkersMock).toHaveBeenCalledWith(ctx.configService, ctx.watcherService, 'workers')
    expect(watchWorkersMock).toHaveBeenCalledTimes(2)
    expect(resolveTouchAppWxssEnabledMock).toHaveBeenCalledTimes(1)
    expect(touchMock).toHaveBeenCalledWith('/project/dist/app.wxss')
    expect(ctx.watcherService.setRollupWatcher).toHaveBeenCalledWith(expect.any(Object), '/')
  })

  it('prints hmr phase timings on rebuild completion and resets the profile', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    ctx.runtimeState.build.hmr.profile = {
      file: '/project/src/pages/logs/index.vue',
      event: 'update',
      transformMs: 9.5,
      writeMs: 5.25,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
      sharedChunkResolveMs: 1.75,
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
    buildMock.mockResolvedValueOnce(watcher)
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
    buildMock.mockResolvedValueOnce(watcher)
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
    buildMock.mockResolvedValueOnce(watcher)
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
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('write 4.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('watch->dirty 3.00 ms'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('d/p/e 1/2/2'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('cause entry -> shared+1'))
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('近2次 avg'))
    nowSpy.mockRestore()
  })

  it('writes hmr profile jsonl with default output path when enabled', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
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
      file: '/project/src/pages/logs/index.vue',
      event: 'update',
      transformMs: 9.5,
      writeMs: 5.25,
      watchToDirtyMs: 3.25,
      emitMs: 14.5,
      sharedChunkResolveMs: 1.75,
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
    expect(payload).toContain('"transformMs":9.5')
    expect(payload).toContain('"writeMs":5.25')
    expect(payload).toContain('"buildCoreMs":')
    expect(payload).toContain('"dirtyReasonSummary":["entry-direct:1"]')
    expect(payload).toContain('"pendingReasonSummary":["shared-chunk(common.js)+1:direct"]')
  })

  it('writes hmr profile jsonl to custom relative path', async () => {
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
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
    buildMock.mockResolvedValueOnce(watcher)
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

  it('prints analyze hint when hmr profile is enabled and rebuild becomes much slower', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(130)
      .mockReturnValueOnce(210)
      .mockReturnValueOnce(220)
      .mockReturnValueOnce(310)
      .mockReturnValueOnce(320)
      .mockReturnValueOnce(510)
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
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

    for (const totalMs of [100, 80, 90, 200]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      watcher.emit('START')
      watcher.emit('END')
      await vi.waitFor(() => {
        expect(loggerSuccessMock).toHaveBeenCalled()
      })
    }

    await vi.waitFor(() => {
      expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('weapp-vite analyze --hmr-profile'))
    })
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('当前 190.00 ms'))
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('疑似慢段 emit 100.00 ms'))
    nowSpy.mockRestore()
  })

  it('does not print analyze hint when hmr profile output is disabled', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(130)
      .mockReturnValueOnce(210)
      .mockReturnValueOnce(220)
      .mockReturnValueOnce(310)
      .mockReturnValueOnce(320)
      .mockReturnValueOnce(510)
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    const firstBuild = service.build({ skipNpm: true })
    await watcher.subscribed
    watcher.emit('START')
    watcher.emit('END')
    await firstBuild

    for (const totalMs of [100, 80, 90, 200]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      watcher.emit('START')
      watcher.emit('END')
      await vi.waitFor(() => {
        expect(loggerSuccessMock).toHaveBeenCalled()
      })
    }

    expect(loggerInfoMock).not.toHaveBeenCalled()
    nowSpy.mockRestore()
  })

  it('suppresses repeated slow hmr hints until enough new samples accumulate', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(130)
      .mockReturnValueOnce(210)
      .mockReturnValueOnce(220)
      .mockReturnValueOnce(310)
      .mockReturnValueOnce(320)
      .mockReturnValueOnce(520)
      .mockReturnValueOnce(530)
      .mockReturnValueOnce(740)
      .mockReturnValueOnce(750)
      .mockReturnValueOnce(970)
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
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

    for (const totalMs of [100, 80, 90, 200, 210, 220]) {
      ctx.runtimeState.build.hmr.profile = {
        emitMs: totalMs / 2,
      }
      watcher.emit('START')
      watcher.emit('END')
      await vi.waitFor(() => {
        expect(loggerSuccessMock).toHaveBeenCalled()
      })
    }

    expect(loggerInfoMock).toHaveBeenCalledTimes(1)
    nowSpy.mockRestore()
  })

  it('prefers shared phase hint when shared chunk cost regresses most', async () => {
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(130)
      .mockReturnValueOnce(210)
      .mockReturnValueOnce(220)
      .mockReturnValueOnce(310)
      .mockReturnValueOnce(320)
      .mockReturnValueOnce(510)
    const watcher = createManualWatcher()
    buildMock.mockResolvedValueOnce(watcher)
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

    for (const profile of [
      { emitMs: 20, sharedChunkResolveMs: 6 },
      { emitMs: 22, sharedChunkResolveMs: 7 },
      { emitMs: 24, sharedChunkResolveMs: 8 },
      { emitMs: 26, sharedChunkResolveMs: 90 },
    ]) {
      ctx.runtimeState.build.hmr.profile = profile
      watcher.emit('START')
      watcher.emit('END')
      await vi.waitFor(() => {
        expect(loggerSuccessMock).toHaveBeenCalled()
      })
    }

    await vi.waitFor(() => {
      expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('疑似慢段 shared 90.00 ms'))
    })
    nowSpy.mockRestore()
  })

  it('skips npm build when skipNpm is enabled and hmr touch is false', async () => {
    buildMock.mockResolvedValueOnce(createWatcher(['START', 'END']))
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
    buildMock.mockResolvedValueOnce(createWatcher(['START', 'END']))
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

  it('cleans output in dev when cleanOutputsInDev is true', async () => {
    buildMock.mockResolvedValueOnce(createWatcher(['START', 'END']))
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
    buildMock.mockResolvedValueOnce(createWatcher(['START', 'END']))
    const ctx = createMockContext()
    ctx.runtimeState.build.npmBuilt = true
    ctx.npmService.checkDependenciesCacheOutdate.mockResolvedValueOnce(false)
    const service = createBuildService(ctx)

    await service.build()

    expect(ctx.npmService.build).not.toHaveBeenCalled()
    expect(ctx.npmService.checkDependenciesCacheOutdate).toHaveBeenCalledTimes(1)
  })

  it('rejects dev build when watcher emits error', async () => {
    buildMock.mockResolvedValueOnce(createWatcher(['ERROR']))
    const ctx = createMockContext()
    const service = createBuildService(ctx)

    await expect(service.build({ skipNpm: true })).rejects.toEqual({
      code: 'ERROR',
    })
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

  it('preloads app entry before concurrent prod npm build when local subpackage npm config exists', async () => {
    process.env.NODE_ENV = 'production'
    buildMock.mockResolvedValueOnce({ output: [] })

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
    const service = createBuildService(ctx)

    await service.build()

    expect(ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.loadSubPackages).toHaveBeenCalledTimes(1)
    expect(ctx.npmService.build).toHaveBeenCalledTimes(1)
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
    buildMock.mockResolvedValueOnce(createWatcher(['START', 'END']))
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
