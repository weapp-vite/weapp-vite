import { cac } from 'cac'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildServiceMock = vi.hoisted(() => ({
  build: vi.fn(),
}))
const createCompilerContextMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const resolveForwardConsoleOptionsMock = vi.hoisted(() => vi.fn())
const startForwardConsoleBridgeMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('./openIde', () => ({
  openIde: vi.fn(),
  resolveIdeCommandContext: resolveIdeCommandContextMock,
  resolveIdeProjectRoot: vi.fn(),
}))

vi.mock('./forwardConsole', () => ({
  maybeStartForwardConsole: vi.fn(),
  resolveForwardConsoleOptions: resolveForwardConsoleOptionsMock,
  startForwardConsoleBridge: startForwardConsoleBridgeMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
}))

describe('cli command routing', () => {
  beforeEach(() => {
    vi.resetModules()
    buildServiceMock.build.mockReset()
    createCompilerContextMock.mockReset()
    resolveIdeCommandContextMock.mockReset()
    resolveForwardConsoleOptionsMock.mockReset()
    startForwardConsoleBridgeMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()

    buildServiceMock.build.mockResolvedValue(undefined)
    createCompilerContextMock.mockResolvedValue({
      buildService: buildServiceMock,
      configService: {
        platform: 'weapp',
        cwd: '/workspace/template',
        mpDistRoot: 'dist',
        weappViteConfig: {},
        packageManager: { agent: 'pnpm' },
      },
      webService: undefined,
    })
    resolveIdeCommandContextMock.mockResolvedValue({
      platform: 'weapp',
      projectPath: '/workspace/template',
      weappViteConfig: {},
    })
    resolveForwardConsoleOptionsMock.mockResolvedValue({
      enabled: true,
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    })
    startForwardConsoleBridgeMock.mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('matches ide logs before default serve command', async () => {
    const { registerIdeCommand } = await import('./commands/ide')
    const { registerServeCommand } = await import('./commands/serve')
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      if (event === 'SIGINT') {
        queueMicrotask(() => {
          handler()
        })
      }
      return process
    }) as any)
    const processOffSpy = vi.spyOn(process, 'off').mockImplementation((() => process) as any)
    const cli = cac('weapp-vite')

    registerIdeCommand(cli)
    registerServeCommand(cli)

    cli.parse(['node', 'weapp-vite', 'ide', 'logs'], { run: false })
    await cli.runMatchedCommand()

    expect(startForwardConsoleBridgeMock).toHaveBeenCalledTimes(1)
    expect(buildServiceMock.build).not.toHaveBeenCalled()

    processOnSpy.mockRestore()
    processOffSpy.mockRestore()
  })
})
