import { beforeEach, describe, expect, it, vi } from 'vitest'

const determineAgentMock = vi.hoisted(() => vi.fn())
const startForwardConsoleMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))

vi.mock('@vercel/detect-agent', () => ({
  determineAgent: determineAgentMock,
}))

vi.mock('weapp-ide-cli', () => ({
  startForwardConsole: startForwardConsoleMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
}))

describe('forwardConsole', () => {
  beforeEach(() => {
    vi.resetModules()
    determineAgentMock.mockReset()
    startForwardConsoleMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()
    determineAgentMock.mockResolvedValue({
      isAgent: false,
    })
    startForwardConsoleMock.mockResolvedValue({
      close: vi.fn(),
    })
  })

  it('enables auto mode when running in an AI terminal', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { resolveForwardConsoleOptions } = await import('./forwardConsole')

    await expect(resolveForwardConsoleOptions()).resolves.toEqual({
      enabled: true,
      agentName: 'codex',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    })
  })

  it('respects explicit disable config', async () => {
    const { resolveForwardConsoleOptions } = await import('./forwardConsole')

    await expect(resolveForwardConsoleOptions({
      forwardConsole: false,
    })).resolves.toEqual({
      enabled: false,
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    })

    expect(determineAgentMock).not.toHaveBeenCalled()
  })

  it('starts weapp console forwarding when enabled', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {},
    })

    expect(started).toBe(true)
    expect(startForwardConsoleMock).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: 'dist/dev',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    }))
  })

  it('skips non-weapp platforms', async () => {
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      platform: 'alipay',
      mpDistRoot: 'dist/alipay/dist',
      weappViteConfig: {
        forwardConsole: true,
      },
    })

    expect(started).toBe(false)
    expect(startForwardConsoleMock).not.toHaveBeenCalled()
  })

  it('falls back when forward console startup fails', async () => {
    startForwardConsoleMock.mockRejectedValue(new Error('DEVTOOLS_HTTP_PORT_ERROR'))
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })

    expect(started).toBe(false)
    expect(loggerMock.warn).toHaveBeenCalledWith('[forwardConsole] 启动失败，回退到普通 IDE 打开流程：DEVTOOLS_HTTP_PORT_ERROR')
  })

  it('falls back to cwd when mpDistRoot parent is current directory', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist',
      cwd: '/workspace/template',
      weappViteConfig: {},
    })

    expect(started).toBe(true)
    expect(startForwardConsoleMock).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: '/workspace/template',
    }))
  })
})
