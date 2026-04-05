import { Buffer } from 'node:buffer'
import { PNG } from 'pngjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const withMiniProgramMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
}))

vi.mock('../src/cli/automator-session', () => ({
  withMiniProgram: withMiniProgramMock,
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

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    withMiniProgramMock.mockReset()
    loggerMock.info.mockReset()
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

  it('normalizes page paths before relaunching', async () => {
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

  it('stitches multiple viewport screenshots when fullPage is enabled', async () => {
    const red = createSolidPng(8, 20, [255, 0, 0, 255])
    const green = createSolidPng(8, 20, [0, 255, 0, 255])
    const blue = createSolidPng(8, 20, [0, 0, 255, 255])
    const pageScrollTo = vi.fn()
    const waitFor = vi.fn().mockResolvedValue(undefined)
    const screenshot = vi.fn()
      .mockResolvedValueOnce(red.toString('base64'))
      .mockResolvedValueOnce(green.toString('base64'))
      .mockResolvedValueOnce(blue.toString('base64'))

    withMiniProgramMock.mockImplementation(async (_options, runner) => {
      return await runner({
        currentPage: () => Promise.resolve({
          size: () => Promise.resolve({ width: 8, height: 45 }),
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
    const stitched = PNG.sync.read(result)

    expect(pageScrollTo).toHaveBeenNthCalledWith(1, 0)
    expect(pageScrollTo).toHaveBeenNthCalledWith(2, 20)
    expect(pageScrollTo).toHaveBeenNthCalledWith(3, 25)
    expect(waitFor).toHaveBeenCalledTimes(3)
    expect(stitched.height).toBe(45)
    expect(stitched.width).toBe(8)
    expect(Array.from(stitched.data.slice(0, 4))).toEqual([255, 0, 0, 255])
    expect(Array.from(stitched.data.slice(20 * 8 * 4, 20 * 8 * 4 + 4))).toEqual([0, 255, 0, 255])
    expect(Array.from(stitched.data.slice(40 * 8 * 4, 40 * 8 * 4 + 4))).toEqual([0, 0, 255, 255])
  })
})
