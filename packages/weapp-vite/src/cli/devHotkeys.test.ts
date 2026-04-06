import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const takeScreenshotMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const startWeappViteMcpServerMock = vi.hoisted(() => vi.fn())
const closeMcpMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}))

class FakeStdin extends EventEmitter {
  isTTY = true
  setRawMode = vi.fn()
  resume = vi.fn()
  pause = vi.fn()
}

async function flushMicrotasks(times = 4) {
  for (let index = 0; index < times; index++) {
    await Promise.resolve()
  }
}

vi.mock('weapp-ide-cli', () => ({
  takeScreenshot: takeScreenshotMock,
}))

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
  },
}))

vi.mock('../mcp', () => ({
  resolveWeappMcpConfig: vi.fn((input: any) => {
    if (input === false) {
      return {
        autoStart: false,
        enabled: false,
        endpoint: '/mcp',
        host: '127.0.0.1',
        port: 3088,
      }
    }
    return {
      autoStart: Boolean(input?.autoStart),
      enabled: input?.enabled !== false,
      endpoint: input?.endpoint ?? '/mcp',
      host: input?.host ?? '127.0.0.1',
      port: input?.port ?? 3088,
    }
  }),
  startWeappViteMcpServer: startWeappViteMcpServerMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
  colors: {
    bold: (value: string) => value,
    green: (value: string) => value,
    cyan: (value: string) => value,
  },
}))

describe('devHotkeys', () => {
  let stdin: FakeStdin
  let killMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T10:11:12.345Z'))
    stdin = new FakeStdin()
    killMock = vi.fn()
    mkdirMock.mockReset()
    mkdirMock.mockResolvedValue(undefined)
    closeMcpMock.mockReset()
    closeMcpMock.mockResolvedValue(undefined)
    startWeappViteMcpServerMock.mockReset()
    startWeappViteMcpServerMock.mockResolvedValue({
      close: closeMcpMock,
      transport: 'streamable-http',
    })
    takeScreenshotMock.mockReset()
    takeScreenshotMock.mockResolvedValue({ path: '/project/.tmp/weapp-vite-dev-screenshots/screenshot-2026-04-06T10-11-12-345Z.png' })
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.success.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts hotkeys in weapp tty mode', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    expect(session).toBeDefined()
    expect(stdin.setRawMode).toHaveBeenCalledWith(true)
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('按 h 查看帮助'))

    session?.close()
    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
  })

  it('prints full help on h hotkey', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.emit('keypress', 'h', { name: 'h' })

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('快捷命令'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('帮助'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('重新显示这份帮助'))
  })

  it('runs screenshot action and writes logs', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { runScreenshotAction } = await import('./devHotkeys')

    await runScreenshotAction({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    expect(takeScreenshotMock).toHaveBeenCalledWith({
      outputPath: '/project/.tmp/weapp-vite-dev-screenshots/screenshot-2026-04-06T10-11-12-345Z.png',
      projectPath: '/project/dist',
      timeout: 30000,
    })
    expect(loggerMock.success).toHaveBeenCalledWith(expect.stringContaining('当前页面截图完成'))
  })

  it('skips hotkeys for non-weapp platforms', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'alipay',
      projectPath: '/project/dist',
    })

    expect(session).toBeUndefined()
    expect(takeScreenshotMock).not.toHaveBeenCalled()
  })

  it('toggles mcp service with hotkey', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      mcpConfig: {
        autoStart: false,
      },
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('keypress', '', { name: 'm' })
    await flushMicrotasks()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: '/mcp',
      host: '127.0.0.1',
      port: 3088,
      transport: 'streamable-http',
      unref: false,
      workspaceRoot: '/project',
    })

    stdin.emit('keypress', '', { name: 'm' })
    await flushMicrotasks()

    expect(closeMcpMock).toHaveBeenCalledTimes(1)
    session?.close()
  })

  it('restores terminal and forwards sigint on ctrl+c', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('keypress', '\u0003', { ctrl: true, name: 'c' })

    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
    expect(killMock).toHaveBeenCalledWith(1234, 'SIGINT')
  })

  it('quits dev on q hotkey', async () => {
    vi.doMock('node:process', () => ({
      default: {
        kill: killMock,
        pid: 1234,
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('keypress', 'q', { name: 'q' })

    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
    expect(killMock).toHaveBeenCalledWith(1234, 'SIGINT')
  })
})
