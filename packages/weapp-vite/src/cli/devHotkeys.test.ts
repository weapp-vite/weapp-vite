import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const takeScreenshotMock = vi.hoisted(() => vi.fn())
const closeSharedMiniProgramMock = vi.hoisted(() => vi.fn())
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

class FakeProcess extends EventEmitter {
  kill = vi.fn()
  pid = 1234
  stdin: FakeStdin

  constructor(stdin: FakeStdin) {
    super()
    this.stdin = stdin
  }
}

async function flushMicrotasks(times = 4) {
  for (let index = 0; index < times; index++) {
    await Promise.resolve()
  }
}

vi.mock('weapp-ide-cli', () => ({
  closeSharedMiniProgram: closeSharedMiniProgramMock,
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

vi.mock('../../package.json', () => ({
  default: {
    version: 'test-version',
  },
}))

describe('devHotkeys', () => {
  let stdin: FakeStdin
  let fakeProcess: FakeProcess

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T10:11:12.345Z'))
    stdin = new FakeStdin()
    fakeProcess = new FakeProcess(stdin)
    mkdirMock.mockReset()
    mkdirMock.mockResolvedValue(undefined)
    closeSharedMiniProgramMock.mockReset()
    closeSharedMiniProgramMock.mockResolvedValue(undefined)
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
      default: fakeProcess,
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
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('开发快捷键已就绪'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('按 h 显示帮助，按 q 退出'))
    expect(loggerMock.info).not.toHaveBeenCalledWith(expect.stringContaining('状态        等待操作'))

    session?.close()
    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
  })

  it('can skip startup hint until restore is called', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
      silentStartupHint: true,
    })

    expect(loggerMock.info).not.toHaveBeenCalledWith(expect.stringContaining('按 h 显示帮助，按 q 退出'))

    session?.restore()

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('按 h 显示帮助，按 q 退出'))
    session?.close()
  })

  it('does not print duplicate hint panels when restore is called repeatedly without state changes', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
      silentStartupHint: true,
    })

    session?.restore()
    session?.restore()

    expect(loggerMock.info).toHaveBeenCalledTimes(1)
    session?.close()
  })

  it('prints full help on h hotkey', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.emit('data', 'h')

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('快捷命令'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('进程控制'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('帮助'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('当前状态：等待操作 / MCP 未启动'))
  })

  it('supports fullwidth hotkeys such as ｈ under ime-style input', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.emit('data', 'ｈ')

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('快捷命令'))
  })

  it('prints help again when pressing h repeatedly', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.emit('data', 'h')
    stdin.emit('data', 'h')

    expect(loggerMock.info).toHaveBeenCalledTimes(2)
  })

  it('runs screenshot action and writes logs', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { runScreenshotAction } = await import('./devHotkeys')

    await runScreenshotAction({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    expect(takeScreenshotMock).toHaveBeenCalledWith({
      fullPage: true,
      outputPath: '/project/.tmp/weapp-vite-dev-screenshots/screenshot-2026-04-06T10-11-12-345Z.png',
      projectPath: '/project/dist',
      sharedSession: true,
      timeout: 30000,
    })
    expect(loggerMock.success).toHaveBeenCalledWith(expect.stringContaining('当前页面截图完成'))
  })

  it('skips hotkeys for non-weapp platforms', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
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
      default: fakeProcess,
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

    loggerMock.info.mockClear()
    stdin.emit('data', 'm')
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('正在启动 MCP 服务'))
    await flushMicrotasks()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: '/mcp',
      host: '127.0.0.1',
      port: 3088,
      transport: 'streamable-http',
      unref: false,
      workspaceRoot: '/project',
    })
    expect(loggerMock.info).toHaveBeenLastCalledWith(expect.stringContaining('开发快捷键已就绪'))

    stdin.emit('data', 'm')
    await flushMicrotasks()

    expect(closeMcpMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.info).toHaveBeenLastCalledWith(expect.stringContaining('开发快捷键已就绪'))
    session?.close()
  })

  it('shows screenshot summary in hint after screenshot action', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.emit('data', 's')
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('正在截图当前页面'))
    await flushMicrotasks(10)

    expect(loggerMock.info).toHaveBeenLastCalledWith(expect.stringContaining('开发快捷键已就绪'))
  })

  it('reuses shared devtools sessions across screenshots', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('data', 's')
    await flushMicrotasks(10)
    stdin.emit('data', 's')
    await flushMicrotasks(10)

    expect(takeScreenshotMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      fullPage: true,
      sharedSession: true,
    }))
    expect(takeScreenshotMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      fullPage: true,
      sharedSession: true,
    }))

    session?.close()
    expect(closeSharedMiniProgramMock).toHaveBeenCalledWith('/project/dist')
  })

  it('shows running action in full help when action is in progress', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    let resolveScreenshot: ((value: { path: string }) => void) | undefined
    takeScreenshotMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveScreenshot = resolve as (value: { path: string }) => void
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.emit('data', 's')
    stdin.emit('data', 'h')

    expect(loggerMock.info.mock.calls.some(args =>
      String(args[0]).includes('当前状态：正在截图当前页面 / MCP 未启动'),
    )).toBe(true)
    expect(loggerMock.info.mock.calls.some(args =>
      String(args[0]).includes('执行中    正在截图当前页面'),
    )).toBe(true)

    resolveScreenshot?.({ path: '/project/.tmp/weapp-vite-dev-screenshots/screenshot-2026-04-06T10-11-12-345Z.png' })
    await flushMicrotasks(10)
  })

  it('warns with the current running action when pressing another hotkey while busy', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    let resolveScreenshot: ((value: { path: string }) => void) | undefined
    takeScreenshotMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveScreenshot = resolve as (value: { path: string }) => void
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('data', 's')
    stdin.emit('data', 'm')

    expect(loggerMock.warn).toHaveBeenCalledWith('[dev action] 当前正在截图当前页面，请稍后再试。')

    resolveScreenshot?.({ path: '/project/.tmp/weapp-vite-dev-screenshots/screenshot-2026-04-06T10-11-12-345Z.png' })
    await flushMicrotasks(10)
  })

  it('restores terminal and forwards sigint on ctrl+c', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('data', '\u0003')

    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
    expect(fakeProcess.kill).toHaveBeenCalledWith(1234, 'SIGINT')
  })

  it('temporarily restores terminal and forwards sigtstp on ctrl+z, then reattaches on sigcont', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    loggerMock.info.mockClear()
    stdin.setRawMode.mockClear()
    stdin.pause.mockClear()
    stdin.resume.mockClear()

    stdin.emit('data', '\u001A')

    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalledTimes(1)
    expect(fakeProcess.kill).toHaveBeenCalledWith(1234, 'SIGTSTP')

    fakeProcess.emit('SIGCONT')

    expect(stdin.setRawMode).toHaveBeenCalledWith(true)
    expect(stdin.resume).toHaveBeenCalledTimes(2)
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('按 h 显示帮助，按 q 退出'))
  })

  it('quits dev on q hotkey', async () => {
    vi.doMock('node:process', () => ({
      default: fakeProcess,
    }))
    const { startDevHotkeys } = await import('./devHotkeys')
    startDevHotkeys({
      cwd: '/project',
      mcpConfig: undefined,
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    stdin.emit('data', 'q')

    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
    expect(fakeProcess.kill).toHaveBeenCalledWith(1234, 'SIGINT')
  })
})
