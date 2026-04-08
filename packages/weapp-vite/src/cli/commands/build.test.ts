import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { registerBuildCommand } from './build'

const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const isUiEnabledMock = vi.hoisted(() => vi.fn(() => true))
const resolveRuntimeTargetsMock = vi.hoisted(() => vi.fn(() => ({
  runMini: true,
  runWeb: false,
  mpPlatform: 'weapp',
  rawPlatform: 'weapp',
})))
const createInlineConfigMock = vi.hoisted(() => vi.fn(() => ({})))
const logRuntimeTargetMock = vi.hoisted(() => vi.fn())
const createCompilerContextMock = vi.hoisted(() => vi.fn())
const analyzeSubpackagesMock = vi.hoisted(() => vi.fn())
const startAnalyzeDashboardMock = vi.hoisted(() => vi.fn())
const logBuildPackageSizeReportMock = vi.hoisted(() => vi.fn())
const logBuildAppFinishMock = vi.hoisted(() => vi.fn())
const openIdeMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())

vi.mock('../../logger', () => ({
  default: {
    success: loggerSuccessMock,
    error: vi.fn(),
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
      syncSupportFiles: false,
      preloadAppEntry: false,
    }))
    expect(analyzeSubpackages).toHaveBeenCalledTimes(1)
    expect(startAnalyzeDashboard).toHaveBeenCalledTimes(1)
    const handle = vi.mocked(startAnalyzeDashboard).mock.results[0]?.value
    const resolvedHandle = await handle

    expect(resolvedHandle?.emitRuntimeEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'build',
        level: 'success',
        title: 'mini build completed',
        detail: expect.stringContaining('1 个包'),
        durationMs: expect.any(Number),
      }),
    ])
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('小程序构建完成，耗时：'))
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
})
