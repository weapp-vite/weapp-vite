import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const withMiniProgramMock = vi.hoisted(() => vi.fn())
const closeSharedMiniProgramMock = vi.hoisted(() => vi.fn())
const closeWechatIdeProjectMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}))

const tempDirs: string[] = []

vi.mock('../src/cli/automator-session', () => ({
  closeSharedMiniProgram: closeSharedMiniProgramMock,
  withMiniProgram: withMiniProgramMock,
}))

vi.mock('../src/cli/wechat-commands', () => ({
  closeWechatIdeProject: closeWechatIdeProjectMock,
}))

vi.mock('../src/logger', () => ({
  colors: {
    cyan: (value: string) => value,
  },
  default: loggerMock,
}))

describe('captureScreenshotBuffer', () => {
  function createSolidPng(width: number, height: number, rgba: [number, number, number, number]) {
    const png = new PNG({ width, height })

    for (let index = 0; index < png.data.length; index += 4) {
      png.data[index] = rgba[0]
      png.data[index + 1] = rgba[1]
      png.data[index + 2] = rgba[2]
      png.data[index + 3] = rgba[3]
    }

    return PNG.sync.write(png)
  }

  function createViewportPng(options: {
    width: number
    contentHeight: number
    fixedBottomHeight: number
    contentRgba: [number, number, number, number]
    fixedBottomRgba: [number, number, number, number]
  }) {
    const png = new PNG({
      width: options.width,
      height: options.contentHeight + options.fixedBottomHeight,
    })

    for (let row = 0; row < png.height; row += 1) {
      const rgba = row < options.contentHeight
        ? options.contentRgba
        : options.fixedBottomRgba
      for (let column = 0; column < png.width; column += 1) {
        const index = (row * png.width + column) * 4
        png.data[index] = rgba[0]
        png.data[index + 1] = rgba[1]
        png.data[index + 2] = rgba[2]
        png.data[index + 3] = rgba[3]
      }
    }

    return PNG.sync.write(png)
  }

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    withMiniProgramMock.mockReset()
    closeSharedMiniProgramMock.mockReset()
    closeWechatIdeProjectMock.mockReset()
    closeWechatIdeProjectMock.mockResolvedValue(undefined)
    loggerMock.success.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
  })

  afterEach(async () => {
    vi.useRealTimers()
    await Promise.all(tempDirs.splice(0).map(async tempDir => fs.rm(tempDir, {
      force: true,
      recursive: true,
    })))
  })

  it('rejects with a timeout error when DevTools does not respond to captureScreenshot', async () => {
    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        screenshot: () => new Promise(() => {}),
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const pending = captureScreenshotBuffer({
      projectPath: '/workspace/project',
      timeout: 1234,
    })
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'DEVTOOLS_SCREENSHOT_TIMEOUT',
    })

    await vi.advanceTimersByTimeAsync(1234)

    await assertion
  })

  it('forwards the configured timeout to miniProgram.screenshot', async () => {
    const screenshot = vi.fn().mockResolvedValue(Buffer.from('png-data').toString('base64'))
    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        screenshot,
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      timeout: 4321,
    })

    expect(screenshot).toHaveBeenCalledWith({ timeout: 4321 })
  })

  it('returns the decoded png buffer when DevTools responds with base64', async () => {
    const expected = Buffer.from('png-data')
    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        screenshot: () => Promise.resolve(expected.toString('base64')),
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      timeout: 1234,
    })

    expect(result.equals(expected)).toBe(true)
  })

  it('creates parent directories before writing screenshot output', async () => {
    const expected = Buffer.from('png-data')
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-screenshot-output-'))
    tempDirs.push(tempDir)
    const outputPath = path.join(tempDir, 'nested', 'screenshots', 'index.png')
    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        screenshot: () => Promise.resolve(expected.toString('base64')),
      })
    })

    const { takeScreenshot } = await import('../src/cli/commands')
    const result = await takeScreenshot({
      outputPath,
      projectPath: '/workspace/project',
    })

    expect(result).toEqual({ path: outputPath })
    await expect(fs.readFile(outputPath)).resolves.toEqual(expected)
  })

  it('normalizes page paths before relaunching', async () => {
    const callWxMethod = vi.fn()
    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        callWxMethod,
        screenshot: () => Promise.resolve(Buffer.from('png-data').toString('base64')),
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')

    await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      page: 'pages/index/index',
    })

    expect(callWxMethod).toHaveBeenCalledWith('reLaunch', { url: '/pages/index/index' })
  })

  it('falls back to automator relaunch before screenshot when callWxMethod is unavailable', async () => {
    const reLaunch = vi.fn()
    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        reLaunch,
        screenshot: () => Promise.resolve(Buffer.from('png-data').toString('base64')),
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')

    await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      page: 'pages/index/index',
    })

    expect(reLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('retries without page navigation when screenshot navigation protocol times out', async () => {
    const expected = Buffer.from('png-data')
    const callWxMethod = vi.fn().mockRejectedValue(Object.assign(
      new Error('DevTools did not respond to protocol method App.callWxMethod within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.callWxMethod',
      },
    ))
    let callCount = 0
    withMiniProgramMock.mockImplementation(async (options, runner) => {
      callCount += 1
      if (callCount === 2) {
        expect(options.page).toBeUndefined()
        expect(options.sharedSession).toBe(false)
        expect(options.preferOpenedSession).toBe(false)
      }
      return await runner({
        ...(callCount === 1 ? { callWxMethod } : {}),
        screenshot: () => Promise.resolve(expected.toString('base64')),
      })
    })

    const { takeScreenshot } = await import('../src/cli/commands')
    const result = await takeScreenshot({
      projectPath: '/workspace/project',
      page: 'pages/index/index',
    })

    expect(result).toEqual({ base64: expected.toString('base64') })
    expect(withMiniProgramMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('截图前跳转页面 /pages/index/index 超时'))
  })

  it('skips devtools reconnect log when an existing miniProgram session is provided', async () => {
    const screenshot = vi.fn().mockResolvedValue(Buffer.from('png-data').toString('base64'))
    withMiniProgramMock.mockImplementation(async (options, runner) => {
      return await runner(options.miniProgram)
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      miniProgram: {
        screenshot,
      } as any,
      projectPath: '/workspace/project',
    })

    expect(result.equals(Buffer.from('png-data'))).toBe(true)
    expect(loggerMock.info).not.toHaveBeenCalledWith(expect.stringContaining('正在连接 DevTools'))
    expect(withMiniProgramMock).toHaveBeenCalledTimes(1)
  })

  it('stitches multiple viewport screenshots when fullPage is enabled', async () => {
    const red = createSolidPng(8, 20, [255, 0, 0, 255])
    const green = createSolidPng(8, 20, [0, 255, 0, 255])
    const blue = createSolidPng(8, 20, [0, 0, 255, 255])
    const pageScrollTo = vi.fn()
    const scrollTop = vi.fn().mockResolvedValue(13)
    const waitFor = vi.fn().mockResolvedValue(undefined)
    let sizeHeight = 45
    const screenshot = vi.fn()
      .mockResolvedValueOnce(red.toString('base64'))
      .mockResolvedValueOnce(green.toString('base64'))
      .mockResolvedValueOnce(blue.toString('base64'))

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size: () => Promise.resolve({ width: 8, height: sizeHeight }),
          scrollTop,
          waitFor,
        }),
        systemInfo: () => Promise.resolve({ windowHeight: 20 }),
        pageScrollTo,
        screenshot,
      })
    })
    pageScrollTo.mockImplementation((value: number) => {
      scrollTop.mockResolvedValue(value)
      sizeHeight = 45
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      fullPage: true,
      timeout: 1234,
    })
    const stitched = PNG.sync.read(result)

    expect(pageScrollTo).toHaveBeenNthCalledWith(1, 0)
    expect(pageScrollTo).toHaveBeenNthCalledWith(2, 20)
    expect(pageScrollTo).toHaveBeenNthCalledWith(3, 40)
    expect(pageScrollTo).toHaveBeenNthCalledWith(4, 13)
    expect(waitFor).toHaveBeenCalledTimes(4)
    expect(stitched.height).toBe(45)
    expect(stitched.width).toBe(8)
    expect(Array.from(stitched.data.slice(0, 4))).toEqual([255, 0, 0, 255])
    expect(Array.from(stitched.data.slice(20 * 8 * 4, 20 * 8 * 4 + 4))).toEqual([0, 255, 0, 255])
    expect(Array.from(stitched.data.slice(40 * 8 * 4, 40 * 8 * 4 + 4))).toEqual([0, 0, 255, 255])
  })

  it('uses runtime viewport metrics before Page.getWindowProperties for fullPage screenshots', async () => {
    const red = createSolidPng(8, 20, [255, 0, 0, 255])
    const green = createSolidPng(8, 20, [0, 255, 0, 255])
    const blue = createSolidPng(8, 20, [0, 0, 255, 255])
    const pageScrollTo = vi.fn()
    const size = vi.fn().mockRejectedValue(new Error('Page.getWindowProperties timeout'))
    const scrollTop = vi.fn().mockRejectedValue(new Error('Page.getWindowProperties timeout'))
    const waitFor = vi.fn().mockResolvedValue(undefined)
    let actualScrollTop = 0
    const evaluate = vi.fn().mockImplementation(() => Promise.resolve({
      pageHeight: 45,
      pageWidth: 8,
      scrollTop: actualScrollTop,
      viewportHeight: 20,
    }))
    const screenshot = vi.fn()
      .mockResolvedValueOnce(red.toString('base64'))
      .mockResolvedValueOnce(green.toString('base64'))
      .mockResolvedValueOnce(blue.toString('base64'))

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size,
          scrollTop,
          waitFor,
        }),
        evaluate,
        pageScrollTo,
        screenshot,
      })
    })
    pageScrollTo.mockImplementation((value: number) => {
      actualScrollTop = value
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      fullPage: true,
      timeout: 1234,
    })
    const stitched = PNG.sync.read(result)

    expect(size).not.toHaveBeenCalled()
    expect(scrollTop).not.toHaveBeenCalled()
    expect(evaluate).toHaveBeenCalled()
    expect(stitched.height).toBe(45)
    expect(stitched.width).toBe(8)
  })

  it('keeps fixed bottom chrome only once when stitching fullPage screenshots', async () => {
    const first = createViewportPng({
      width: 8,
      contentHeight: 80,
      fixedBottomHeight: 20,
      contentRgba: [255, 0, 0, 255],
      fixedBottomRgba: [16, 16, 16, 255],
    })
    const second = createViewportPng({
      width: 8,
      contentHeight: 80,
      fixedBottomHeight: 20,
      contentRgba: [0, 255, 0, 255],
      fixedBottomRgba: [16, 16, 16, 255],
    })
    const third = createViewportPng({
      width: 8,
      contentHeight: 80,
      fixedBottomHeight: 20,
      contentRgba: [0, 0, 255, 255],
      fixedBottomRgba: [16, 16, 16, 255],
    })
    const pageScrollTo = vi.fn()
    const waitFor = vi.fn().mockResolvedValue(undefined)
    let actualScrollTop = 0
    const screenshot = vi.fn()
      .mockResolvedValueOnce(first.toString('base64'))
      .mockResolvedValueOnce(second.toString('base64'))
      .mockResolvedValueOnce(second.toString('base64'))
      .mockResolvedValueOnce(third.toString('base64'))

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size: () => Promise.resolve({ width: 8, height: 240 }),
          scrollTop: () => Promise.resolve(actualScrollTop),
          waitFor,
        }),
        systemInfo: () => Promise.resolve({ windowHeight: 100 }),
        pageScrollTo,
        screenshot,
      })
    })
    pageScrollTo.mockImplementation((value: number) => {
      actualScrollTop = value
      return Promise.resolve()
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      fullPage: true,
      timeout: 1234,
    })
    const stitched = PNG.sync.read(result)
    const rowPixel = (row: number) => Array.from(stitched.data.slice(row * 8 * 4, row * 8 * 4 + 4))

    expect(pageScrollTo).toHaveBeenNthCalledWith(1, 0)
    expect(pageScrollTo).toHaveBeenNthCalledWith(2, 100)
    expect(pageScrollTo).toHaveBeenNthCalledWith(3, 80)
    expect(pageScrollTo).toHaveBeenNthCalledWith(4, 160)
    expect(stitched.height).toBe(260)
    expect(rowPixel(0)).toEqual([255, 0, 0, 255])
    expect(rowPixel(80)).toEqual([0, 255, 0, 255])
    expect(rowPixel(160)).toEqual([0, 0, 255, 255])
    expect(rowPixel(239)).toEqual([0, 0, 255, 255])
    expect(rowPixel(240)).toEqual([16, 16, 16, 255])
  })

  it('uses actual scrollTop to avoid duplicated rows when pageScrollTo is clamped', async () => {
    const first = createViewportPng({
      width: 8,
      contentHeight: 80,
      fixedBottomHeight: 20,
      contentRgba: [255, 0, 0, 255],
      fixedBottomRgba: [16, 16, 16, 255],
    })
    const second = createViewportPng({
      width: 8,
      contentHeight: 80,
      fixedBottomHeight: 20,
      contentRgba: [0, 255, 0, 255],
      fixedBottomRgba: [16, 16, 16, 255],
    })
    const third = createViewportPng({
      width: 8,
      contentHeight: 80,
      fixedBottomHeight: 20,
      contentRgba: [0, 0, 255, 255],
      fixedBottomRgba: [16, 16, 16, 255],
    })
    const pageScrollTo = vi.fn()
    const waitFor = vi.fn().mockResolvedValue(undefined)
    const actualScrollTops = [0, 72, 72, 152, 160]
    let captureIndex = -1
    const screenshot = vi.fn()
      .mockResolvedValueOnce(first.toString('base64'))
      .mockResolvedValueOnce(second.toString('base64'))
      .mockResolvedValueOnce(second.toString('base64'))
      .mockResolvedValueOnce(third.toString('base64'))
      .mockResolvedValueOnce(third.toString('base64'))

    pageScrollTo.mockImplementation(() => {
      captureIndex += 1
      return Promise.resolve()
    })

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size: () => Promise.resolve({ width: 8, height: 240 }),
          scrollTop: () => Promise.resolve(actualScrollTops[captureIndex] ?? 160),
          waitFor,
        }),
        systemInfo: () => Promise.resolve({ windowHeight: 100 }),
        pageScrollTo,
        screenshot,
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      fullPage: true,
      timeout: 1234,
    })
    const stitched = PNG.sync.read(result)
    const rowPixel = (row: number) => Array.from(stitched.data.slice(row * 8 * 4, row * 8 * 4 + 4))

    expect(pageScrollTo).toHaveBeenNthCalledWith(1, 0)
    expect(pageScrollTo).toHaveBeenNthCalledWith(2, 100)
    expect(pageScrollTo).toHaveBeenNthCalledWith(3, 80)
    expect(pageScrollTo).toHaveBeenNthCalledWith(4, 152)
    expect(pageScrollTo).toHaveBeenNthCalledWith(5, 232)
    expect(stitched.height).toBe(260)
    expect(rowPixel(0)).toEqual([255, 0, 0, 255])
    expect(rowPixel(72)).toEqual([255, 0, 0, 255])
    expect(rowPixel(80)).toEqual([0, 255, 0, 255])
    expect(rowPixel(151)).toEqual([0, 255, 0, 255])
    expect(rowPixel(152)).toEqual([0, 0, 255, 255])
    expect(rowPixel(240)).toEqual([16, 16, 16, 255])
  })

  it('falls back to viewport screenshot when fullPage scroll metrics hit DevTools inspectee globals', async () => {
    const expected = createSolidPng(8, 20, [255, 0, 0, 255])
    const pageScrollTo = vi.fn().mockRejectedValue(new Error('__inspectee__ is not defined'))
    const waitFor = vi.fn().mockResolvedValue(undefined)
    const screenshot = vi.fn().mockResolvedValue(expected.toString('base64'))

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size: () => Promise.resolve({ width: 8, height: 45 }),
          scrollTop: () => Promise.resolve(0),
          waitFor,
        }),
        systemInfo: () => Promise.resolve({ windowHeight: 20 }),
        pageScrollTo,
        screenshot,
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')
    const result = await captureScreenshotBuffer({
      projectPath: '/workspace/project',
      fullPage: true,
      timeout: 1234,
    })

    expect(result.equals(expected)).toBe(true)
    expect(screenshot).toHaveBeenCalledTimes(1)
    expect(pageScrollTo).toHaveBeenCalledWith(0)
  })

  it('restores the original scroll position when fullPage capture fails', async () => {
    const pageScrollTo = vi.fn()
    const scrollTop = vi.fn().mockResolvedValue(42)
    const waitFor = vi.fn().mockResolvedValue(undefined)
    const screenshot = vi.fn()
      .mockResolvedValueOnce(Buffer.from('not-a-png').toString('base64'))

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size: () => Promise.resolve({ width: 8, height: 45 }),
          scrollTop,
          waitFor,
        }),
        systemInfo: () => Promise.resolve({ windowHeight: 20 }),
        pageScrollTo,
        screenshot,
      })
    })

    const { captureScreenshotBuffer } = await import('../src/cli/commands')

    await expect(captureScreenshotBuffer({
      projectPath: '/workspace/project',
      fullPage: true,
      timeout: 1234,
    })).rejects.toThrow()

    expect(pageScrollTo).toHaveBeenLastCalledWith(42)
  })

  it('retries once with a fresh session when opened-session screenshot times out', async () => {
    const expected = Buffer.from('png-data')
    let callCount = 0

    withMiniProgramMock.mockImplementation(async (options, runner) => {
      callCount += 1
      if (callCount === 1) {
        expect(options.preferOpenedSession).toBeUndefined()
        throw new Error('DEVTOOLS_PROTOCOL_TIMEOUT')
      }

      expect(options.sharedSession).toBe(false)
      expect(options.preferOpenedSession).toBe(false)
      return await runner({
        screenshot: () => Promise.resolve(expected.toString('base64')),
      })
    })

    const { takeScreenshot } = await import('../src/cli/commands')
    const result = await takeScreenshot({
      projectPath: '/workspace/project',
    })

    expect(result).toEqual({ base64: expected.toString('base64') })
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(closeSharedMiniProgramMock).toHaveBeenCalledWith('/workspace/project')
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('正在改用全新自动化会话重试一次'))
    expect(withMiniProgramMock).toHaveBeenCalledTimes(2)
  })

  it('retries once when a fresh-session screenshot times out', async () => {
    const expected = Buffer.from('png-data')
    let callCount = 0

    withMiniProgramMock.mockImplementation(async (options, runner) => {
      callCount += 1
      expect(options.preferOpenedSession).toBe(false)

      if (callCount === 1) {
        throw new Error('DEVTOOLS_PROTOCOL_TIMEOUT')
      }

      expect(options.sharedSession).toBe(false)
      return await runner({
        screenshot: () => Promise.resolve(expected.toString('base64')),
      })
    })

    const { takeScreenshot } = await import('../src/cli/commands')

    const result = await takeScreenshot({
      preferOpenedSession: false,
      projectPath: '/workspace/project',
    })

    expect(result).toEqual({ base64: expected.toString('base64') })
    expect(withMiniProgramMock).toHaveBeenCalledTimes(2)
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(closeSharedMiniProgramMock).toHaveBeenCalledWith('/workspace/project')
  })

  it('retries once when screenshot capture times out after the DevTools request hangs', async () => {
    const expected = Buffer.from('png-data')
    let callCount = 0

    withMiniProgramMock.mockImplementation(async (options, runner) => {
      callCount += 1

      if (callCount === 1) {
        return await runner({
          screenshot: () => new Promise(() => {}),
        })
      }

      expect(options.sharedSession).toBe(false)
      expect(options.preferOpenedSession).toBe(false)
      return await runner({
        screenshot: () => Promise.resolve(expected.toString('base64')),
      })
    })

    const { takeScreenshot } = await import('../src/cli/commands')
    const pending = takeScreenshot({
      projectPath: '/workspace/project',
    })

    await vi.advanceTimersByTimeAsync(60_000)

    await expect(pending).resolves.toEqual({ base64: expected.toString('base64') })
    expect(withMiniProgramMock).toHaveBeenCalledTimes(2)
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(closeSharedMiniProgramMock).toHaveBeenCalledWith('/workspace/project')
  })

  it('does not retry more than once when screenshot protocol timeouts persist', async () => {
    withMiniProgramMock.mockRejectedValue(new Error('DEVTOOLS_PROTOCOL_TIMEOUT'))

    const { takeScreenshot } = await import('../src/cli/commands')

    await expect(takeScreenshot({
      preferOpenedSession: false,
      projectPath: '/workspace/project',
    })).rejects.toThrow('DEVTOOLS_PROTOCOL_TIMEOUT')

    expect(withMiniProgramMock).toHaveBeenCalledTimes(2)
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(closeSharedMiniProgramMock).toHaveBeenCalledWith('/workspace/project')
  })

  it('does not close and relaunch DevTools when fresh-session retry is disabled', async () => {
    withMiniProgramMock.mockRejectedValue(new Error('DEVTOOLS_PROTOCOL_TIMEOUT'))

    const { takeScreenshot } = await import('../src/cli/commands')

    await expect(takeScreenshot({
      preferOpenedSession: false,
      projectPath: '/workspace/project',
      retryWithFreshSession: false,
    })).rejects.toThrow('DEVTOOLS_PROTOCOL_TIMEOUT')

    expect(withMiniProgramMock).toHaveBeenCalledTimes(1)
    expect(closeWechatIdeProjectMock).not.toHaveBeenCalled()
    expect(closeSharedMiniProgramMock).not.toHaveBeenCalled()
  })
})
