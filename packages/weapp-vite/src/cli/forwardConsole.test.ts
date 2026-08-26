import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const determineAgentMock = vi.hoisted(() => vi.fn())
const isRetryableAutomatorLaunchErrorMock = vi.hoisted(() => vi.fn())
const resolveProjectAutomatorPortMock = vi.hoisted(() => vi.fn())
const startForwardConsoleMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))
const colorsMock = vi.hoisted(() => ({
  bold: vi.fn((value: string) => value),
  cyan: vi.fn((value: string) => value),
  dim: vi.fn((value: string) => value),
  green: vi.fn((value: string) => value),
  red: vi.fn((value: string) => value),
  yellow: vi.fn((value: string) => value),
}))
let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

vi.mock('@vercel/detect-agent', () => ({
  determineAgent: determineAgentMock,
}))

vi.mock('weapp-ide-cli', () => ({
  isRetryableAutomatorLaunchError: isRetryableAutomatorLaunchErrorMock,
  resolveProjectAutomatorPort: resolveProjectAutomatorPortMock,
  startForwardConsole: startForwardConsoleMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
  colors: colorsMock,
}))

describe('forwardConsole', () => {
  beforeEach(() => {
    vi.resetModules()
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    determineAgentMock.mockReset()
    isRetryableAutomatorLaunchErrorMock.mockReset()
    resolveProjectAutomatorPortMock.mockReset()
    startForwardConsoleMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()
    colorsMock.bold.mockClear()
    colorsMock.cyan.mockClear()
    colorsMock.dim.mockClear()
    colorsMock.green.mockClear()
    colorsMock.red.mockClear()
    colorsMock.yellow.mockClear()
    determineAgentMock.mockResolvedValue({
      isAgent: false,
    })
    isRetryableAutomatorLaunchErrorMock.mockImplementation((error: unknown) => (
      error instanceof Error && /Wait timed out after \d+ ms/i.test(error.message)
    ))
    resolveProjectAutomatorPortMock.mockReturnValue(10261)
    startForwardConsoleMock.mockResolvedValue({
      close: vi.fn(),
    })
  })

  afterEach(() => {
    stdoutWriteSpy.mockRestore()
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
      port: 10261,
      timeout: 120_000,
      logLevels: ['log', 'info', 'warn', 'error'],
      openedOnly: undefined,
      preferOpenedSession: undefined,
      preserveProjectRoot: true,
      unhandledErrors: true,
    }))
    expect(resolveProjectAutomatorPortMock).toHaveBeenCalledWith('dist/dev')
  })

  it('pauses and resumes the active console forwarding session', async () => {
    const close = vi.fn()
    startForwardConsoleMock.mockResolvedValueOnce({ close })
    const { maybeStartForwardConsole, pauseActiveForwardConsole } = await import('./forwardConsole')

    await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })

    const resume = await pauseActiveForwardConsole()
    expect(close).toHaveBeenCalledTimes(1)
    expect(startForwardConsoleMock).toHaveBeenCalledTimes(1)

    await resume?.()
    expect(startForwardConsoleMock).toHaveBeenCalledTimes(2)
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectPath: 'dist/dev',
      port: 10261,
    }))
  })

  it('closes and clears the active console forwarding session', async () => {
    const close = vi.fn()
    startForwardConsoleMock.mockResolvedValueOnce({ close })
    const { closeActiveForwardConsole, maybeStartForwardConsole } = await import('./forwardConsole')

    await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })
    await closeActiveForwardConsole()
    await closeActiveForwardConsole()

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closes a console forwarding session that finishes after shutdown starts', async () => {
    let resolveSession: ((value: { close: ReturnType<typeof vi.fn> }) => void) | undefined
    const close = vi.fn()
    startForwardConsoleMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSession = resolve
    }))
    const { closeActiveForwardConsole, maybeStartForwardConsole } = await import('./forwardConsole')

    const start = maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })
    await vi.waitFor(() => {
      expect(resolveSession).toBeDefined()
    })
    const shutdown = closeActiveForwardConsole()
    resolveSession?.({ close })

    await expect(start).resolves.toBe(false)
    await expect(shutdown).resolves.toBeUndefined()
    expect(close).toHaveBeenCalledTimes(1)

    await expect(maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })).resolves.toBe(true)
    expect(startForwardConsoleMock).toHaveBeenCalledTimes(2)
  })

  it('can restrict console forwarding to an opened automator session', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      openedOnly: true,
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {},
    })

    expect(started).toBe(true)
    expect(startForwardConsoleMock).toHaveBeenCalledWith(expect.objectContaining({
      openedOnly: true,
      projectPath: 'dist/dev',
      port: 10261,
    }))
  })

  it('can start a fresh project automator session after cli open', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      platform: 'weapp',
      preferOpenedSession: false,
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {},
    })

    expect(started).toBe(true)
    expect(startForwardConsoleMock).toHaveBeenCalledWith(expect.objectContaining({
      preferOpenedSession: false,
      preserveProjectRoot: true,
      projectPath: 'dist/dev',
      port: 10261,
    }))
  })

  it('does not repeat a full bridge launch after the short retry window is exhausted', async () => {
    vi.useFakeTimers()
    startForwardConsoleMock.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 11_000))
      throw new Error('DEVTOOLS_WS_CONNECT_ERROR')
    })
    const { startForwardConsoleBridge } = await import('./forwardConsole')

    const started = startForwardConsoleBridge({
      logLevels: ['error'],
      onReadyMessage: 'ready',
      projectPath: 'dist/dev',
      unhandledErrors: true,
    })
    const rejected = expect(started).rejects.toThrow('DEVTOOLS_WS_CONNECT_ERROR')
    await vi.advanceTimersByTimeAsync(11_000)

    await rejected
    expect(startForwardConsoleMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('reopens through automator after a cli-opened session stops answering protocol calls', async () => {
    const close = vi.fn()
    const recoverAutomatorSession = vi.fn().mockResolvedValue(undefined)
    startForwardConsoleMock
      .mockRejectedValueOnce(new Error('DEVTOOLS_PROTOCOL_TIMEOUT'))
      .mockResolvedValueOnce({ close })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    await expect(maybeStartForwardConsole({
      platform: 'weapp',
      preferOpenedSession: false,
      recoverAutomatorSession,
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })).resolves.toBe(true)

    expect(recoverAutomatorSession).toHaveBeenCalledTimes(1)
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      timeout: 60_000,
    }))
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      openedOnly: true,
      port: 10261,
      preferOpenedSession: true,
      projectPath: 'dist/dev',
    }))
  })

  it('reopens through automator after the initial launch timeout is exhausted', async () => {
    const close = vi.fn()
    const recoverAutomatorSession = vi.fn().mockResolvedValue(undefined)
    startForwardConsoleMock
      .mockRejectedValueOnce(new Error('Wait timed out after 60000 ms'))
      .mockResolvedValueOnce({ close })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    await expect(maybeStartForwardConsole({
      platform: 'weapp',
      preferOpenedSession: false,
      recoverAutomatorSession,
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })).resolves.toBe(true)

    expect(recoverAutomatorSession).toHaveBeenCalledTimes(1)
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      openedOnly: true,
      preferOpenedSession: true,
    }))
  })

  it('reopens through automator after the stable websocket retries are exhausted', async () => {
    vi.useFakeTimers()
    const close = vi.fn()
    const recoverAutomatorSession = vi.fn().mockResolvedValue(undefined)
    for (let index = 0; index < 6; index += 1) {
      startForwardConsoleMock.mockRejectedValueOnce(new Error('DEVTOOLS_WS_CONNECT_ERROR'))
    }
    startForwardConsoleMock.mockResolvedValueOnce({ close })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = maybeStartForwardConsole({
      platform: 'weapp',
      preferOpenedSession: false,
      recoverAutomatorSession,
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })
    await vi.runAllTimersAsync()

    await expect(started).resolves.toBe(true)
    expect(recoverAutomatorSession).toHaveBeenCalledTimes(1)
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      timeout: 60_000,
    }))
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(7, expect.objectContaining({
      openedOnly: true,
      port: 10261,
      preferOpenedSession: true,
      projectPath: 'dist/dev',
    }))
    vi.useRealTimers()
  })

  it('falls back to the opened default automator session when project port is unavailable', async () => {
    vi.useFakeTimers()
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    for (let index = 0; index < 6; index += 1) {
      startForwardConsoleMock.mockRejectedValueOnce(new Error('DEVTOOLS_WS_CONNECT_ERROR'))
    }
    startForwardConsoleMock.mockResolvedValueOnce({
      close: vi.fn(),
    })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const promise = maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {},
    })
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe(true)
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      projectPath: 'dist/dev',
      port: 10261,
    }))
    expect(startForwardConsoleMock).toHaveBeenNthCalledWith(7, expect.objectContaining({
      openedOnly: true,
      preferOpenedSession: true,
      projectPath: 'dist/dev',
      port: undefined,
    }))
    vi.useRealTimers()
  })

  it('keeps colors enabled for explicitly enabled user terminals', async () => {
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    const started = await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })

    expect(started).toBe(true)
    expect(startForwardConsoleMock).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: 'dist/dev',
    }))
  })

  it('formats AI terminal forwarded logs without ANSI colors', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {},
    })
    const onLog = startForwardConsoleMock.mock.calls[0]?.[0].onLog
    onLog({
      level: 'warn',
      message: 'plain warning',
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith('[mini:warn ] plain warning\n')
    expect(loggerMock.log).not.toHaveBeenCalled()
    expect(loggerMock.warn).not.toHaveBeenCalled()
    expect(colorsMock.yellow).not.toHaveBeenCalled()
    expect(colorsMock.bold).not.toHaveBeenCalled()
  })

  it('formats user terminal forwarded logs with colors', async () => {
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })
    const onLog = startForwardConsoleMock.mock.calls[0]?.[0].onLog
    onLog({
      level: 'warn',
      message: 'colored warning',
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith('[mini:warn ] colored warning\n')
    expect(loggerMock.log).not.toHaveBeenCalled()
    expect(loggerMock.warn).not.toHaveBeenCalled()
    expect(colorsMock.yellow).toHaveBeenCalled()
    expect(colorsMock.bold).toHaveBeenCalled()
  })

  it('writes forwarded errors as raw mini log lines without logger error framing', async () => {
    const { maybeStartForwardConsole } = await import('./forwardConsole')

    await maybeStartForwardConsole({
      platform: 'weapp',
      mpDistRoot: 'dist/dev/mp-weixin',
      weappViteConfig: {
        forwardConsole: true,
      },
    })
    const onLog = startForwardConsoleMock.mock.calls[0]?.[0].onLog
    onLog({
      level: 'error',
      message: 'colored error',
    })

    expect(stdoutWriteSpy).toHaveBeenCalledWith('[mini:error] colored error\n')
    expect(loggerMock.log).not.toHaveBeenCalled()
    expect(loggerMock.error).not.toHaveBeenCalled()
    expect(colorsMock.red).toHaveBeenCalled()
    expect(colorsMock.bold).toHaveBeenCalled()
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
