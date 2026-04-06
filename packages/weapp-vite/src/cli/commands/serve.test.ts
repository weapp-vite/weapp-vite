import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { registerServeCommand } from './serve'

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
const logBuildAppFinishMock = vi.hoisted(() => vi.fn())
const maybeStartForwardConsoleMock = vi.hoisted(() => vi.fn())
const openIdeMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const devHotkeysCloseMock = vi.hoisted(() => vi.fn())
const devHotkeysRestoreMock = vi.hoisted(() => vi.fn())
const startDevHotkeysMock = vi.hoisted(() => vi.fn(() => ({
  close: devHotkeysCloseMock,
  restore: devHotkeysRestoreMock,
})))

vi.mock('../../logger', () => ({
  default: {
    success: loggerSuccessMock,
    warn: vi.fn(),
    error: vi.fn(),
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

vi.mock('../logBuildAppFinish', () => ({
  logBuildAppFinish: logBuildAppFinishMock,
}))

vi.mock('../forwardConsole', () => ({
  maybeStartForwardConsole: maybeStartForwardConsoleMock,
}))

vi.mock('../openIde', () => ({
  openIde: openIdeMock,
  resolveIdeProjectRoot: vi.fn((root: string) => root),
}))

vi.mock('../devHotkeys', () => ({
  startDevHotkeys: startDevHotkeysMock,
}))

function createServeActionHandler() {
  let actionHandler: ((root: string, options: any) => Promise<void>) | undefined
  const chain = {
    alias: vi.fn(() => chain),
    option: vi.fn(() => chain),
    action: vi.fn((handler: (root: string, options: any) => Promise<void>) => {
      actionHandler = handler
      return chain
    }),
  }
  const cli = {
    command: vi.fn(() => chain),
  }

  registerServeCommand(cli as any)
  if (!actionHandler) {
    throw new Error('failed to capture serve action handler')
  }
  return actionHandler
}

describe('serve cli command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    devHotkeysCloseMock.mockReset()
    devHotkeysRestoreMock.mockReset()
    resolveConfigFileMock.mockReturnValue(undefined)
    const emitRuntimeEvents = vi.fn()
    const update = vi.fn().mockResolvedValue(undefined)
    createCompilerContextMock
      .mockResolvedValueOnce({
        buildService: {
          build: vi.fn().mockResolvedValue({}),
        },
        configService: {
          platform: 'weapp',
          cwd: '/project',
          mode: 'development',
          outDir: '/project/dist',
          mpDistRoot: '/project/dist',
          packageManager: { agent: 'pnpm' },
          weappViteConfig: {},
        },
        webService: undefined,
      })
      .mockResolvedValue({
        configService: {
          cwd: '/project',
          mode: 'development',
        },
      })
    analyzeSubpackagesMock
      .mockResolvedValueOnce({
        packages: [{ id: 'initial', label: 'initial', files: [] }],
        modules: [],
        subPackages: [],
      })
      .mockResolvedValueOnce({
        packages: [{ id: 'refresh', label: 'refresh', files: [] }],
        modules: [{ id: 'm1', source: 'src/a.ts', sourceType: 'src', packages: [] }],
        subPackages: [],
      })
    startAnalyzeDashboardMock.mockResolvedValue({
      emitRuntimeEvents,
      update,
      waitForExit: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      urls: ['http://127.0.0.1:4173/'],
    })
  })

  it('emits initial analyze lifecycle events when ui mode is enabled in serve', async () => {
    const action = createServeActionHandler()

    await action('/project', {
      platform: 'weapp',
      ui: true,
    })

    expect(createCompilerContext).toHaveBeenCalledTimes(3)
    expect(analyzeSubpackages).toHaveBeenCalledTimes(2)
    expect(startAnalyzeDashboard).toHaveBeenCalledTimes(1)
    const resolvedHandle = await vi.mocked(startAnalyzeDashboard).mock.results[0]?.value

    expect(resolvedHandle?.emitRuntimeEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'command',
        level: 'success',
        title: 'dev ui session ready',
      }),
    ])
    expect(resolvedHandle?.emitRuntimeEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'build',
        level: 'info',
        title: 'initial analyze started',
      }),
    ])
    expect(resolvedHandle?.emitRuntimeEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'build',
        level: 'success',
        title: 'initial analyze completed',
        durationMs: expect.any(Number),
      }),
    ])
    expect(resolvedHandle?.update).toHaveBeenCalledWith({
      packages: [{ id: 'refresh', label: 'refresh', files: [] }],
      modules: [{ id: 'm1', source: 'src/a.ts', sourceType: 'src', packages: [] }],
      subPackages: [],
    })
    expect(startDevHotkeysMock).toHaveBeenCalledWith({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })
    expect(devHotkeysRestoreMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('小程序初次构建完成，耗时：'))
  })

  it('forwards trust-project setting when opening ide in serve mode', async () => {
    const action = createServeActionHandler()

    await action('/project', {
      platform: 'weapp',
      open: true,
      trustProject: false,
    })

    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/project/dist', {
      trustProject: false,
    })
    expect(devHotkeysRestoreMock).toHaveBeenCalledTimes(2)
  })
})
