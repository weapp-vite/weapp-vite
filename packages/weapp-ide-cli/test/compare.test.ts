import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const captureScreenshotBufferMock = vi.hoisted(() => vi.fn())
const comparePngWithBaselineMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
}))

vi.mock('../src/cli/commands', async () => {
  const actual = await vi.importActual<typeof import('../src/cli/commands')>('../src/cli/commands')
  return {
    ...actual,
    captureScreenshotBuffer: captureScreenshotBufferMock,
  }
})

vi.mock('../src/cli/imageDiff', () => ({
  comparePngWithBaseline: comparePngWithBaselineMock,
}))

vi.mock('../src/logger', () => ({
  colors: {
    bold: (value: string) => value,
    green: (value: string) => value,
    red: (value: string) => value,
    cyan: (value: string) => value,
  },
  default: loggerMock,
}))

async function loadModule() {
  return import('../src/cli/compare')
}

describe('compare helpers', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace/project')
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    captureScreenshotBufferMock.mockReset()
    comparePngWithBaselineMock.mockReset()
    loggerMock.info.mockReset()
    captureScreenshotBufferMock.mockResolvedValue(Buffer.from('png'))
    comparePngWithBaselineMock.mockResolvedValue({
      baselinePath: '/baseline.png',
      currentPath: '/current.png',
      diffPath: '/diff.png',
      width: 100,
      height: 200,
      diffPixels: 10,
      diffRatio: 0.0005,
    })
    process.exitCode = undefined
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    logSpy.mockRestore()
    process.exitCode = undefined
  })

  describe('parseCompareArgs', () => {
    it('uses cwd as default project path', async () => {
      const { parseCompareArgs } = await loadModule()

      const options = parseCompareArgs(['--baseline', '/baseline.png', '--max-diff-pixels', '0'])

      expect(options).toMatchObject({
        projectPath: '/workspace/project',
        baselinePath: '/baseline.png',
        threshold: 0.1,
        maxDiffPixels: 0,
      })
    })

    it('parses mixed options together', async () => {
      const { parseCompareArgs } = await loadModule()

      const options = parseCompareArgs([
        '-p',
        '/project',
        '--baseline',
        '/baseline.png',
        '--current-output',
        '/current.png',
        '--diff-output=/diff.png',
        '--page',
        'pages/home/index',
        '--full-page',
        '--threshold',
        '0.2',
        '--max-diff-pixels',
        '12',
        '--max-diff-ratio',
        '0.03',
        '-t',
        '5000',
      ])

      expect(options).toEqual({
        projectPath: '/project',
        timeout: 5000,
        page: 'pages/home/index',
        fullPage: true,
        baselinePath: '/baseline.png',
        currentOutputPath: '/current.png',
        diffOutputPath: '/diff.png',
        threshold: 0.2,
        maxDiffPixels: 12,
        maxDiffRatio: 0.03,
      })
    })

    it('throws when baseline is missing', async () => {
      const { parseCompareArgs } = await loadModule()

      expect(() => parseCompareArgs(['--max-diff-pixels', '1'])).toThrow('--baseline')
    })

    it('throws when both maxDiffPixels and maxDiffRatio are missing', async () => {
      const { parseCompareArgs } = await loadModule()

      expect(() => parseCompareArgs(['--baseline', '/baseline.png'])).toThrow('--max-diff-pixels')
    })

    it('throws when threshold is invalid', async () => {
      const { parseCompareArgs } = await loadModule()

      expect(() => parseCompareArgs([
        '--baseline',
        '/baseline.png',
        '--threshold',
        '-1',
        '--max-diff-pixels',
        '1',
      ])).toThrow('--threshold')
    })

    it('throws when maxDiffPixels is invalid', async () => {
      const { parseCompareArgs } = await loadModule()

      expect(() => parseCompareArgs([
        '--baseline',
        '/baseline.png',
        '--max-diff-pixels',
        '1.5',
      ])).toThrow('--max-diff-pixels')
    })

    it('throws when maxDiffRatio is outside 0 to 1', async () => {
      const { parseCompareArgs } = await loadModule()

      expect(() => parseCompareArgs([
        '--baseline',
        '/baseline.png',
        '--max-diff-ratio',
        '1.2',
      ])).toThrow('--max-diff-ratio')
    })
  })

  describe('runCompare', () => {
    it('prints help when argv contains --help', async () => {
      const { runCompare } = await loadModule()

      await runCompare(['--help'])

      expect(captureScreenshotBufferMock).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: weapp compare [options]'))
    })

    it('prints json result when --json is provided', async () => {
      const { runCompare } = await loadModule()

      await runCompare([
        '--baseline',
        '/baseline.png',
        '--max-diff-pixels',
        '100',
        '--json',
      ])

      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
        passed: true,
        baselinePath: '/baseline.png',
        currentPath: '/current.png',
        diffPath: '/diff.png',
        width: 100,
        height: 200,
        diffPixels: 10,
        diffRatio: 0.0005,
        threshold: 0.1,
        maxDiffPixels: 100,
        maxDiffRatio: undefined,
      }, null, 2))
      expect(process.exitCode).toBeUndefined()
    })

    it('passes fullPage through to screenshot capture', async () => {
      const { runCompare } = await loadModule()

      await runCompare([
        '--baseline',
        '/baseline.png',
        '--page',
        'pages/index/index',
        '--full-page',
        '--max-diff-pixels',
        '100',
      ])

      expect(captureScreenshotBufferMock).toHaveBeenCalledWith(expect.objectContaining({
        page: 'pages/index/index',
        fullPage: true,
      }))
    })

    it('prints text summary and sets exitCode to 1 when comparison fails', async () => {
      comparePngWithBaselineMock.mockResolvedValueOnce({
        baselinePath: '/baseline.png',
        currentPath: '/current.png',
        diffPath: '/diff.png',
        width: 100,
        height: 200,
        diffPixels: 200,
        diffRatio: 0.5,
      })
      const { runCompare } = await loadModule()

      await runCompare([
        '--baseline',
        '/baseline.png',
        '--max-diff-pixels',
        '100',
      ])

      expect(logSpy).toHaveBeenCalledWith('compare failed: diffPixels=200 diffRatio=0.5')
      expect(process.exitCode).toBe(1)
    })

    it('maps argument errors to exitCode 2', async () => {
      const { runCompare } = await loadModule()

      await expect(runCompare(['--baseline', '/baseline.png'])).rejects.toMatchObject({ exitCode: 2 })
    })

    it('maps screenshot capture errors to exitCode 3', async () => {
      captureScreenshotBufferMock.mockRejectedValueOnce(new Error('capture failed'))
      const { runCompare } = await loadModule()

      await expect(runCompare([
        '--baseline',
        '/baseline.png',
        '--max-diff-pixels',
        '1',
      ])).rejects.toMatchObject({ exitCode: 3, message: 'capture failed' })
    })

    it('maps image diff errors to exitCode 3', async () => {
      comparePngWithBaselineMock.mockRejectedValueOnce(new Error('diff failed'))
      const { runCompare } = await loadModule()

      await expect(runCompare([
        '--baseline',
        '/baseline.png',
        '--max-diff-pixels',
        '1',
      ])).rejects.toMatchObject({ exitCode: 3, message: 'diff failed' })
    })
  })
})
