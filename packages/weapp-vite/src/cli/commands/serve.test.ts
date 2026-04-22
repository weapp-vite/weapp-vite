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
const resolveIdeProjectRootMock = vi.hoisted(() => vi.fn((root: string) => root))
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const devHotkeysCloseMock = vi.hoisted(() => vi.fn())
const devHotkeysRestoreMock = vi.hoisted(() => vi.fn())
const watcherCloseAllMock = vi.hoisted(() => vi.fn())
const buildServiceBuildMock = vi.hoisted(() => vi.fn())
const fakeProcess = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: any[]) => void>>()
  return {
    env: {} as Record<string, string | undefined>,
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach(listener => listener(...args))
    },
    on(event: string, listener: (...args: any[]) => void) {
      const bucket = listeners.get(event) ?? new Set<(...args: any[]) => void>()
      bucket.add(listener)
      listeners.set(event, bucket)
      return this
    },
    off(event: string, listener: (...args: any[]) => void) {
      listeners.get(event)?.delete(listener)
      return this
    },
    removeAllListeners() {
      listeners.clear()
      return this
    },
  }
})
const startDevHotkeysMock = vi.hoisted(() => vi.fn(() => ({
  close: devHotkeysCloseMock,
  restore: devHotkeysRestoreMock,
})))

vi.mock('node:process', () => ({
  default: fakeProcess,
}))

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
  resolveIdeProjectRoot: resolveIdeProjectRootMock,
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
    resolveIdeProjectRootMock.mockReset()
    resolveIdeProjectRootMock.mockImplementation((root: string) => root)
    const emitRuntimeEvents = vi.fn()
    const update = vi.fn().mockResolvedValue(undefined)
    buildServiceBuildMock.mockReset()
    buildServiceBuildMock.mockResolvedValue({})
    createCompilerContextMock
      .mockResolvedValueOnce({
        buildService: {
          build: buildServiceBuildMock,
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
        watcherService: {
          closeAll: watcherCloseAllMock,
        },
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
    watcherCloseAllMock.mockReset()
    fakeProcess.removeAllListeners()
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
      openIde: expect.any(Function),
      platform: 'weapp',
      projectPath: '/project/dist',
      rebuild: expect.any(Function),
      silentStartupHint: true,
    })
    expect(devHotkeysRestoreMock).toHaveBeenCalledTimes(1)
    expect(loggerSuccessMock).toHaveBeenCalledWith(expect.stringContaining('小程序初次构建完成，耗时：'))
  })

  it('forwards trust-project setting when opening ide in serve mode', async () => {
    const action = createServeActionHandler()

    const actionPromise = action('/project', {
      platform: 'weapp',
      open: true,
      trustProject: false,
    })
    fakeProcess.emit('SIGINT')
    await actionPromise

    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/project/dist', {
      reuseOpenedProject: false,
      trustProject: false,
    })
    expect(devHotkeysRestoreMock).toHaveBeenCalledTimes(2)
  })

  it('keeps dev hotkeys session alive until serve shutdown signal arrives', async () => {
    const action = createServeActionHandler()

    const actionPromise = action('/project', {
      platform: 'weapp',
    })

    await Promise.resolve()

    expect(devHotkeysCloseMock).not.toHaveBeenCalled()

    fakeProcess.emit('SIGINT')
    await actionPromise

    expect(devHotkeysCloseMock).toHaveBeenCalledTimes(1)
    expect(watcherCloseAllMock).toHaveBeenCalledTimes(1)
  })

  it('injects rebuild and reopen callbacks into dev hotkeys session', async () => {
    const action = createServeActionHandler()

    const actionPromise = action('/project', {
      platform: 'weapp',
      trustProject: true,
    })

    await Promise.resolve()

    const hotkeyOptions = startDevHotkeysMock.mock.calls[0]?.[0]
    expect(hotkeyOptions).toBeDefined()

    const rebuildResult = await hotkeyOptions.rebuild()
    expect(buildServiceBuildMock).toHaveBeenCalledWith({
      platform: 'weapp',
      trustProject: true,
    })
    expect(rebuildResult).toBe('已手动重新构建当前小程序产物')

    maybeStartForwardConsoleMock.mockResolvedValueOnce(false)
    const openResult = await hotkeyOptions.openIde()
    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/project/dist', {
      reuseOpenedProject: false,
      trustProject: true,
    })
    expect(openResult).toBe('已重新打开微信开发者工具项目')

    fakeProcess.emit('SIGINT')
    await actionPromise
  })

  it('reuses resolved ide project root for hotkeys compile target and reopen callback', async () => {
    resolveIdeProjectRootMock.mockReturnValue('/project/ide-root')
    createCompilerContextMock.mockReset()
    createCompilerContextMock.mockResolvedValueOnce({
      buildService: {
        build: buildServiceBuildMock,
      },
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'development',
        outDir: '/project/dist',
        mpDistRoot: '/project/dist/miniprogram',
        packageManager: { agent: 'pnpm' },
        weappViteConfig: {},
      },
      webService: undefined,
      watcherService: {
        closeAll: watcherCloseAllMock,
      },
    })
    const action = createServeActionHandler()

    const actionPromise = action('/project', {
      platform: 'weapp',
      trustProject: true,
    })

    await Promise.resolve()

    const hotkeyOptions = startDevHotkeysMock.mock.calls[0]?.[0]
    expect(hotkeyOptions?.projectPath).toBe('/project/ide-root')

    maybeStartForwardConsoleMock.mockResolvedValueOnce(false)
    const openResult = await hotkeyOptions.openIde()
    expect(openIdeMock).toHaveBeenCalledWith('weapp', '/project/ide-root', {
      reuseOpenedProject: false,
      trustProject: true,
    })
    expect(openResult).toBe('已重新打开微信开发者工具项目')

    fakeProcess.emit('SIGINT')
    await actionPromise
  })
})
