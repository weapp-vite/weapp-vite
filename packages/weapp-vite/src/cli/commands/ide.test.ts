import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openIdeMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const resolveForwardConsoleOptionsMock = vi.hoisted(() => vi.fn())
const startForwardConsoleBridgeMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../openIde', () => ({
  openIde: openIdeMock,
  resolveIdeCommandContext: resolveIdeCommandContextMock,
}))

vi.mock('../forwardConsole', () => ({
  resolveForwardConsoleOptions: resolveForwardConsoleOptionsMock,
  startForwardConsoleBridge: startForwardConsoleBridgeMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

describe('ide logs command', () => {
  let autoTerminate = true
  let processOnSpy: ReturnType<typeof vi.spyOn>
  let processOffSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    autoTerminate = true
    openIdeMock.mockReset()
    resolveIdeCommandContextMock.mockReset()
    resolveForwardConsoleOptionsMock.mockReset()
    startForwardConsoleBridgeMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()

    processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      if (event === 'SIGINT' && autoTerminate) {
        queueMicrotask(() => {
          handler()
        })
      }
      return process
    }) as any)
    processOffSpy = vi.spyOn(process, 'off').mockImplementation((() => {
      return process
    }) as any)

    openIdeMock.mockResolvedValue(undefined)
    resolveIdeCommandContextMock.mockResolvedValue({
      platform: 'weapp',
      projectPath: 'dist/dev',
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

  afterEach(() => {
    processOnSpy.mockRestore()
    processOffSpy.mockRestore()
  })

  it('starts ide logs bridge and waits for signals', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('logs', undefined, {})

    expect(startForwardConsoleBridgeMock).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: 'dist/dev',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    }))
    expect(processOffSpy).toHaveBeenCalled()
  })

  it('opens ide first when --open is provided', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('logs', undefined, { open: true })

    expect(openIdeMock).toHaveBeenCalledWith('weapp', 'dist/dev')
  })

  it('rejects non-weapp platforms', async () => {
    resolveIdeCommandContextMock.mockResolvedValue({
      platform: 'alipay',
      projectPath: 'dist/alipay',
      weappViteConfig: {},
    })
    const { runIdeCommand } = await import('./ide')

    await expect(runIdeCommand('logs', undefined, {})).rejects.toThrow('`weapp-vite ide logs` 当前仅支持微信小程序平台。')
  })
})
