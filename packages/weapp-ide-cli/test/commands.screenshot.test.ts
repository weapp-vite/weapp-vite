import { Buffer } from 'node:buffer'
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
})
