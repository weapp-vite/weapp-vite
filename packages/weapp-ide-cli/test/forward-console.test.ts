import { beforeEach, describe, expect, it, vi } from 'vitest'

const acquireSharedMiniProgramMock = vi.hoisted(() => vi.fn())
const connectMiniProgramMock = vi.hoisted(() => vi.fn())
const releaseSharedMiniProgramMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../src/cli/automator-session', () => ({
  acquireSharedMiniProgram: acquireSharedMiniProgramMock,
  connectMiniProgram: connectMiniProgramMock,
  releaseSharedMiniProgram: releaseSharedMiniProgramMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
  colors: {
    bold: (value: string) => value,
    cyan: (value: string) => value,
    dim: (value: string) => value,
    green: (value: string) => value,
    red: (value: string) => value,
    yellow: (value: string) => value,
  },
}))

function createMiniProgramMock() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const miniProgram = {
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
      return miniProgram
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener)
      return miniProgram
    }),
    enableLog: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    emit(event: string, payload: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload)
      }
    },
  }

  return miniProgram
}

describe('forwardConsole', () => {
  beforeEach(() => {
    vi.resetModules()
    acquireSharedMiniProgramMock.mockReset()
    connectMiniProgramMock.mockReset()
    releaseSharedMiniProgramMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()
  })

  it('forwards console events with normalized levels', async () => {
    const miniProgram = createMiniProgramMock()
    const refreshMiniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    connectMiniProgramMock.mockResolvedValue(refreshMiniProgram)
    const onLog = vi.fn()
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    await startForwardConsole({
      projectPath: '/tmp/demo',
      onLog,
    })

    miniProgram.emit('console', {
      type: 'warning',
      args: [
        { value: 'warn' },
        { value: 1 },
      ],
    })

    expect(onLog).toHaveBeenCalledWith({
      level: 'warn',
      message: 'warn 1',
      raw: {
        type: 'warning',
        args: [
          { value: 'warn' },
          { value: 1 },
        ],
      },
    })
  })

  it('filters out disabled log levels', async () => {
    const miniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    const onLog = vi.fn()
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    await startForwardConsole({
      projectPath: '/tmp/demo',
      logLevels: ['error'],
      onLog,
    })

    miniProgram.emit('console', {
      type: 'info',
      text: 'ignored',
    })

    expect(onLog).not.toHaveBeenCalled()
  })

  it('forwards unhandled exceptions by default', async () => {
    const miniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    const onLog = vi.fn()
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    await startForwardConsole({
      projectPath: '/tmp/demo',
      onLog,
    })

    miniProgram.emit('exception', {
      error: {
        message: 'boom',
        stack: 'Error: boom',
      },
    })

    expect(onLog).toHaveBeenCalledWith({
      level: 'error',
      message: 'boom\nError: boom',
      raw: {
        error: {
          message: 'boom',
          stack: 'Error: boom',
        },
      },
    })
  })

  it('can disable unhandled exception forwarding', async () => {
    const miniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    const onLog = vi.fn()
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    await startForwardConsole({
      projectPath: '/tmp/demo',
      unhandledErrors: false,
      onLog,
    })

    miniProgram.emit('exception', {
      error: {
        message: 'boom',
      },
    })

    expect(onLog).not.toHaveBeenCalled()
  })

  it('detaches listeners and closes automator session', async () => {
    const miniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    const session = await startForwardConsole({
      projectPath: '/tmp/demo',
    })

    await session.close()
    await session.close()

    expect(miniProgram.off).toHaveBeenCalledTimes(2)
    expect(releaseSharedMiniProgramMock).toHaveBeenCalledWith('/tmp/demo', undefined)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('waits for App.enableLog before reporting ready', async () => {
    const miniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    const onReady = vi.fn()
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    await startForwardConsole({
      projectPath: '/tmp/demo',
      onReady,
    })

    expect(miniProgram.enableLog).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('refreshes App.enableLog while the session is open and stops on close', async () => {
    vi.useFakeTimers()
    const miniProgram = createMiniProgramMock()
    const refreshMiniProgram = createMiniProgramMock()
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    connectMiniProgramMock.mockResolvedValue(refreshMiniProgram)
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    const session = await startForwardConsole({
      projectPath: '/tmp/demo',
    })
    await vi.advanceTimersByTimeAsync(6_100)

    expect(miniProgram.enableLog).toHaveBeenCalledTimes(4)
    expect(connectMiniProgramMock).toHaveBeenCalledWith(expect.objectContaining({
      openedOnly: true,
      projectPath: '/tmp/demo',
    }))
    expect(refreshMiniProgram.enableLog).toHaveBeenCalledTimes(4)

    await session.close()
    await vi.advanceTimersByTimeAsync(3_000)

    expect(miniProgram.enableLog).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  it('cleans up when App.enableLog cannot be enabled', async () => {
    vi.useFakeTimers()
    const miniProgram = createMiniProgramMock()
    miniProgram.enableLog.mockRejectedValue(new Error('enable log failed'))
    acquireSharedMiniProgramMock.mockResolvedValue(miniProgram)
    const onReady = vi.fn()
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    const promise = startForwardConsole({
      projectPath: '/tmp/demo',
      onReady,
    }).catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toEqual(expect.objectContaining({
      message: 'enable log failed',
    }))
    expect(onReady).not.toHaveBeenCalled()
    expect(miniProgram.off).toHaveBeenCalledTimes(2)
    expect(releaseSharedMiniProgramMock).toHaveBeenCalledWith('/tmp/demo', undefined)
    expect(miniProgram.close).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
