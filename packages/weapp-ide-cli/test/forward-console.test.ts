import { beforeEach, describe, expect, it, vi } from 'vitest'

const connectMiniProgramMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../src/cli/automator-session', () => ({
  connectMiniProgram: connectMiniProgramMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
  colors: {
    dim: (value: string) => value,
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
    close: vi.fn().mockResolvedValue(undefined),
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
    connectMiniProgramMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()
  })

  it('forwards console events with normalized levels', async () => {
    const miniProgram = createMiniProgramMock()
    connectMiniProgramMock.mockResolvedValue(miniProgram)
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
    connectMiniProgramMock.mockResolvedValue(miniProgram)
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
    connectMiniProgramMock.mockResolvedValue(miniProgram)
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
    connectMiniProgramMock.mockResolvedValue(miniProgram)
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
    connectMiniProgramMock.mockResolvedValue(miniProgram)
    const { startForwardConsole } = await import('../src/cli/forwardConsole')

    const session = await startForwardConsole({
      projectPath: '/tmp/demo',
    })

    await session.close()
    await session.close()

    expect(miniProgram.off).toHaveBeenCalledTimes(2)
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
  })
})
