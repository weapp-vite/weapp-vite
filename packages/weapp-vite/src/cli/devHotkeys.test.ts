import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const takeScreenshotMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
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

vi.mock('weapp-ide-cli', () => ({
  takeScreenshot: takeScreenshotMock,
}))

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
  },
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

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T10:11:12.345Z'))
    stdin = new FakeStdin()
    mkdirMock.mockReset()
    mkdirMock.mockResolvedValue(undefined)
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
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      platform: 'weapp',
      projectPath: '/project/dist',
    })

    expect(session).toBeDefined()
    expect(stdin.setRawMode).toHaveBeenCalledWith(true)
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('[dev shortcuts]'))

    session?.close()
    expect(stdin.setRawMode).toHaveBeenCalledWith(false)
    expect(stdin.pause).toHaveBeenCalled()
  })

  it('runs screenshot action and writes logs', async () => {
    vi.doMock('node:process', () => ({
      default: {
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { runScreenshotAction } = await import('./devHotkeys')

    await runScreenshotAction({
      cwd: '/project',
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
        stdin,
      },
    }))
    vi.doMock('node:readline', () => ({
      emitKeypressEvents: vi.fn(),
    }))

    const { startDevHotkeys } = await import('./devHotkeys')
    const session = startDevHotkeys({
      cwd: '/project',
      platform: 'alipay',
      projectPath: '/project/dist',
    })

    expect(session).toBeUndefined()
    expect(takeScreenshotMock).not.toHaveBeenCalled()
  })
})
