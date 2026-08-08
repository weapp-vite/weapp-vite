import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import {
  registerBuildCommand,
  scheduleCompletedProductionBuildExit,
  shouldScheduleCompletedProductionBuildExit,
} from './build'

const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const isUiEnabledMock = vi.hoisted(() => vi.fn(() => true))
const resolveRuntimeTargetsMock = vi.hoisted(() => {
  const miniBackend = {
    descriptor: {
      id: 'miniprogram',
      runtime: 'miniprogram',
      aliases: ['weapp'],
      capabilities: {
        build: true,
        dev: true,
        ide: true,
        analyze: true,
        npm: true,
        workers: true,
        lib: true,
      },
    },
    driver: {
      build: (ctx: any, options: any) => ctx.buildService.build(options),
      close: (ctx: any) => ctx.watcherService.closeAll(),
    },
    platform: 'weapp',
  }
  return vi.fn(() => ({
    kind: 'miniprogram',
    label: 'weapp',
    entries: [miniBackend],
    platform: 'weapp',
    rawPlatform: 'weapp',
    get: (id: string) => id === 'miniprogram' ? miniBackend : undefined,
    has: (capability: string) => Boolean((miniBackend.descriptor.capabilities as any)[capability]),
    select: (capability: string) => (miniBackend.descriptor.capabilities as any)[capability] ? [miniBackend] : [],
  }))
})
const createInlineConfigMock = vi.hoisted(() => vi.fn(() => ({})))
const logRuntimeTargetMock = vi.hoisted(() => vi.fn())
const createCompilerContextMock = vi.hoisted(() => vi.fn())
const analyzeSubpackagesMock = vi.hoisted(() => vi.fn())
const startAnalyzeDashboardMock = vi.hoisted(() => vi.fn())
const logBuildPackageSizeReportMock = vi.hoisted(() => vi.fn())
const logBuildAppFinishMock = vi.hoisted(() => vi.fn())
const openIdeMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_VITEST = process.env.VITEST

vi.mock('../../logger', () => ({
  default: {
    success: loggerSuccessMock,
    error: loggerErrorMock,
  },
  colors: {
    green: (input: string) => input,
  },
}))

vi.mock('../options', () => ({
  filterDuplicateOptions: filterDuplicateOptionsMock,
  resolveConfigFile: resolveConfigFileMock,
  isUiEnabled: isUiEnabledMock,
}))

vi.mock('../runtime', () => ({
  resolveRuntimeTargets: resolveRuntimeTargetsMock,
  createInlineConfig: createInlineConfigMock,
  logRuntimeTarget: logRuntimeTargetMock,
}))

vi.mock('../../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('../../analyze/subpackages', () => ({
  analyzeSubpackages: analyzeSubpackagesMock,
}))

vi.mock('../analyze/dashboard', () => ({
  startAnalyzeDashboard: startAnalyzeDashboardMock,
}))

vi.mock('../logBuildPackageSizeReport', () => ({
  logBuildPackageSizeReport: logBuildPackageSizeReportMock,
}))

vi.mock('../logBuildAppFinish', () => ({
  logBuildAppFinish: logBuildAppFinishMock,
}))

vi.mock('../openIde', () => ({
  openIde: openIdeMock,
  resolveIdeProjectPath: vi.fn((input: string) => input),
}))

function createBuildActionHandler() {
  let actionHandler: ((root: string, options: any) => Promise<void>) | undefined
  const chain = {
    option: vi.fn(() => chain),
    action: vi.fn((handler: (root: string, options: any) => Promise<void>) => {
      actionHandler = handler
      return chain
    }),
  }
  const cli = {
    command: vi.fn(() => chain),
  }

  registerBuildCommand(cli as any)
  if (!actionHandler) {
    throw new Error('failed to capture build action handler')
  }
  return actionHandler
}

describe('build cli command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    delete process.env.WEAPP_VITE_DISABLE_COMPLETED_BUILD_EXIT
    resolveConfigFileMock.mockReturnValue(undefined)
    const emitRuntimeEvents = vi.fn()
    createCompilerContextMock.mockResolvedValue({
      buildService: {
        build: vi.fn().mockResolvedValue({ output: [] }),
      },
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        outDir: '/project/dist',
        mpDistRoot: '/project/dist',
        packageManager: { agent: 'pnpm' },
        weappViteConfig: {
          analyze: {
            history: false,
          },
          packageSizeWarningBytes: 0,
        },
        weappWebConfig: undefined,
      },
      scanService: {
        subPackageMap: new Map(),
      },
      webService: undefined,
      watcherService: {
        closeAll: vi.fn(),
      },
    })
    analyzeSubpackagesMock.mockResolvedValue({
      packages: [{ id: 'main', label: 'main', files: [] }],
      modules: [],
      subPackages: [],
    })
    startAnalyzeDashboardMock.mockResolvedValue({
      emitRuntimeEvents,
      update: vi.fn(),
      waitForExit: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      urls: ['http://127.0.0.1:4173/'],
    })
  })

  it('emits mini build lifecycle event when ui analyze dashboard is enabled', async () => {
    const action = createBuildActionHandler()

    await action('/project', {
      platform: 'weapp',
      ui: true,
    })

    expect(createCompilerContext).toHaveBeenCalledTimes(1)
    expect(createCompilerContext).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/project',
      emitDefaultAutoImportOutputs: false,
      preloadAppEntry: false,
    }))
    expect(analyzeSubpackages).toHaveBeenCalledTimes(1)
    expect(startAnalyzeDashboard).toHaveBeenCalledTimes(1)
    expect(startAnalyzeDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        packages: [{ id: 'main', label: 'main', files: [] }],
      }),
      expect.objectContaining({
        initialEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: 'build',
            level: 'success',
            title: 'mini build completed',
            detail: expect.stringContaining('1 个包'),
            durationMs: expect.any(Number),
          }),
        ]),
      }),
    )
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('小程序构建完成，耗时：'))
  })

  it('passes build output options through inline config', async () => {
    const action = createBuildActionHandler()

    await action('/project', {
      emptyOutDir: true,
      minify: false,
      outDir: 'dist-debug',
      platform: 'weapp',
      sourcemap: true,
    })

    expect(createInlineConfigMock).toHaveBeenCalledWith(expect.anything(), {
      inlineConfig: {
        build: {
          emptyOutDir: true,
          minify: false,
          outDir: 'dist-debug',
          sourcemap: true,
        },
      },
      scope: undefined,
    })
  })

  it('forwards trust-project setting when opening ide after build', async () => {
    const action = createBuildActionHandler()

    await action('/project', {
      platform: 'weapp',
      open: true,
      trustProject: false,
    })

    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/project/dist', {
      trustProject: false,
    })
  })

  it('closes compiler watchers when build fails', async () => {
    const closeAll = vi.fn()
    const buildError = new Error('build failed')
    createCompilerContextMock.mockResolvedValueOnce({
      buildService: {
        build: vi.fn().mockRejectedValue(buildError),
      },
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        outDir: '/project/dist',
        mpDistRoot: '/project/dist',
        packageManager: { agent: 'pnpm' },
        weappViteConfig: {
          analyze: {
            history: false,
          },
          packageSizeWarningBytes: 0,
        },
        weappWebConfig: undefined,
      },
      scanService: {
        subPackageMap: new Map(),
      },
      webService: undefined,
      watcherService: {
        closeAll,
      },
    })
    const action = createBuildActionHandler()

    await expect(action('/project', {
      platform: 'weapp',
    })).rejects.toThrow(buildError)

    expect(closeAll).toHaveBeenCalledTimes(1)
  })

  it('executes a web-only build through the web backend capability', async () => {
    const webBuild = vi.fn().mockResolvedValue(undefined)
    const webClose = vi.fn().mockResolvedValue(undefined)
    const webBackend = {
      descriptor: {
        id: 'web',
        capabilities: { build: true, ide: false },
      },
      driver: {
        build: webBuild,
        close: webClose,
      },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
      has: () => true,
      select: (capability: string) => capability === 'build' ? [webBackend] : [],
    })
    createCompilerContextMock.mockResolvedValueOnce({
      buildService: { build: vi.fn() },
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        outDir: '/project/dist',
        mpDistRoot: '/project/dist',
        packageManager: { agent: 'pnpm' },
        relativeCwd: (input: string) => input.replace('/project/', ''),
        weappViteConfig: { packageSizeWarningBytes: 0 },
        weappWebConfig: {
          enabled: true,
          outDir: '/project/dist/web',
        },
      },
      scanService: { subPackageMap: new Map() },
      watcherService: { closeAll: vi.fn() },
      webService: { build: vi.fn(), close: vi.fn() },
    })
    const action = createBuildActionHandler()

    await action('/project', { platform: 'web' })

    expect(webBuild).toHaveBeenCalledTimes(1)
    expect(webClose).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('Web 构建完成'))
  })

  it('reports a web build failure and still closes the backend', async () => {
    const buildError = new Error('web build failed')
    const webBuild = vi.fn().mockRejectedValue(buildError)
    const webClose = vi.fn().mockResolvedValue(undefined)
    const webBackend = {
      descriptor: { id: 'web', capabilities: { build: true } },
      driver: { build: webBuild, close: webClose },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
      select: (capability: string) => capability === 'build' ? [webBackend] : [],
    })
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'weapp',
        cwd: '/project',
        relativeCwd: (input: string) => input,
        weappViteConfig: {},
        weappWebConfig: { enabled: true, outDir: '/project/dist/web' },
      },
    })
    const action = createBuildActionHandler()

    await expect(action('/project', { platform: 'web' })).rejects.toThrow(buildError)

    expect(loggerErrorMock).toHaveBeenCalledWith(buildError)
    expect(webClose).toHaveBeenCalledTimes(1)
  })

  it('stringifies non-error web build failures', async () => {
    const webClose = vi.fn()
    const webBackend = {
      descriptor: { id: 'web', capabilities: { build: true } },
      driver: {
        build: vi.fn().mockRejectedValue('web build failed'),
        close: webClose,
      },
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
      select: (capability: string) => capability === 'build' ? [webBackend] : [],
    })
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'weapp',
        relativeCwd: (input: string) => input,
        weappViteConfig: {},
        weappWebConfig: { enabled: true, outDir: '/project/dist/web' },
      },
    })

    await expect(createBuildActionHandler()('/project', { platform: 'web' })).rejects.toBe('web build failed')
    expect(loggerErrorMock).toHaveBeenCalledWith('web build failed')
    expect(webClose).toHaveBeenCalledTimes(1)
  })

  it('skips non-web build backends after a mini build', async () => {
    const customBuild = vi.fn()
    const customClose = vi.fn()
    const customBackend = {
      descriptor: { id: 'custom', capabilities: { build: true } },
      driver: { build: customBuild, close: customClose },
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'miniprogram',
      label: 'custom',
      entries: [customBackend],
      rawPlatform: 'custom',
      get: () => undefined,
      select: (capability: string) => capability === 'build' ? [customBackend] : [],
    })
    const action = createBuildActionHandler()

    await action(undefined as any, {})

    expect(customBuild).not.toHaveBeenCalled()
    expect(customClose).toHaveBeenCalledTimes(1)
  })

  it('terminates stale sass embedded child handles and ignores kill errors', async () => {
    const kill = vi.fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('already exited')
      })
    const handlesSpy = vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([
      null,
      { kill, spawnfile: '/bin/sass-embedded' },
      { kill, spawnfile: '/bin/sass-embedded' },
      { kill, spawnfile: '/bin/node' },
    ])
    const action = createBuildActionHandler()

    try {
      await action('/project', { platform: 'weapp' })
      expect(kill).toHaveBeenCalledTimes(2)
    }
    finally {
      handlesSpy.mockRestore()
    }
  })

  it('ignores unavailable active process handles during cleanup', async () => {
    const handlesSpy = vi.spyOn(process as any, '_getActiveHandles').mockReturnValue(undefined)
    const action = createBuildActionHandler()

    try {
      await action('/project', { platform: 'weapp' })
    }
    finally {
      handlesSpy.mockRestore()
    }
  })

  it('supports missing active-handle APIs and context creation failures', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process, '_getActiveHandles')
    Object.defineProperty(process, '_getActiveHandles', {
      configurable: true,
      value: undefined,
    })
    createCompilerContextMock.mockRejectedValueOnce(new Error('invalid config'))

    try {
      await expect(createBuildActionHandler()(undefined as any, {})).rejects.toThrow('invalid config')
    }
    finally {
      if (descriptor) {
        Object.defineProperty(process, '_getActiveHandles', descriptor)
      }
    }
  })

  it('accepts array build output and an unavailable analyze dashboard', async () => {
    createCompilerContextMock.mockResolvedValueOnce({
      buildService: { build: vi.fn().mockResolvedValue([]) },
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        outDir: '/project/dist',
        mpDistRoot: '/project/dist',
        packageManager: { agent: 'pnpm' },
        weappViteConfig: {
          analyze: { history: false },
          packageSizeWarningBytes: 0,
        },
      },
      scanService: {},
      watcherService: { closeAll: vi.fn() },
    })
    startAnalyzeDashboardMock.mockResolvedValueOnce(undefined)

    await createBuildActionHandler()('/project', { platform: 'weapp', ui: true })

    expect(logBuildPackageSizeReportMock).not.toHaveBeenCalled()
    expect(startAnalyzeDashboardMock).toHaveBeenCalledTimes(1)
  })

  it('skips analyze for a mini build when the UI is disabled', async () => {
    isUiEnabledMock.mockReturnValueOnce(false)

    await createBuildActionHandler()('/project', { platform: 'weapp' })

    expect(startAnalyzeDashboardMock).not.toHaveBeenCalled()
  })

  it('schedules process exit only for completed one-shot production cli builds', () => {
    process.env.VITEST = 'false'
    delete process.env.NODE_ENV

    expect(shouldScheduleCompletedProductionBuildExit({}, undefined)).toBe(true)
    expect(shouldScheduleCompletedProductionBuildExit({ watch: true }, undefined)).toBe(false)
    expect(shouldScheduleCompletedProductionBuildExit({ open: true }, undefined)).toBe(false)
    expect(shouldScheduleCompletedProductionBuildExit({}, {
      emitRuntimeEvents: vi.fn(),
      update: vi.fn(),
      waitForExit: vi.fn(),
      close: vi.fn(),
      urls: [],
    })).toBe(false)

    process.env.WEAPP_VITE_DISABLE_COMPLETED_BUILD_EXIT = '1'
    expect(shouldScheduleCompletedProductionBuildExit({}, undefined)).toBe(false)
  })

  it('exits with zero after completed production build when no error exit code is set', () => {
    process.env.VITEST = 'false'
    delete process.env.NODE_ENV
    const originalExitCode = process.exitCode
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    vi.useFakeTimers()

    try {
      process.exitCode = undefined
      scheduleCompletedProductionBuildExit({}, undefined)
      vi.runOnlyPendingTimers()
      expect(exitSpy).toHaveBeenCalledWith(0)

      exitSpy.mockClear()
      process.exitCode = 1
      scheduleCompletedProductionBuildExit({}, undefined)
      vi.runOnlyPendingTimers()
      expect(exitSpy).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
      exitSpy.mockRestore()
      process.exitCode = originalExitCode
    }
  })
})
