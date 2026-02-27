import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseScreenshotArgs } from '../src/cli/screenshot'

describe('screenshot helpers', () => {
  describe('parseScreenshotArgs', () => {
    let cwdSpy: ReturnType<typeof vi.spyOn>
    const mockCwd = '/workspace/project'

    beforeEach(() => {
      cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
    })

    afterEach(() => {
      cwdSpy.mockRestore()
    })

    it('returns default options when no args provided', () => {
      const options = parseScreenshotArgs([])
      expect(options).toEqual({
        projectPath: mockCwd,
      })
    })

    it('parses -p for project path', () => {
      const options = parseScreenshotArgs(['-p', '/path/to/project'])
      expect(options.projectPath).toBe('/path/to/project')
    })

    it('parses --project for project path', () => {
      const options = parseScreenshotArgs(['--project', '/path/to/project'])
      expect(options.projectPath).toBe('/path/to/project')
    })

    it('parses --project=path style', () => {
      const options = parseScreenshotArgs(['--project=/path/to/project'])
      expect(options.projectPath).toBe('/path/to/project')
    })

    it('parses -o for output path', () => {
      const options = parseScreenshotArgs(['-o', 'screenshot.png'])
      expect(options.outputPath).toBe('screenshot.png')
    })

    it('parses --output for output path', () => {
      const options = parseScreenshotArgs(['--output', 'screenshot.png'])
      expect(options.outputPath).toBe('screenshot.png')
    })

    it('parses --output=path style', () => {
      const options = parseScreenshotArgs(['--output=screenshot.png'])
      expect(options.outputPath).toBe('screenshot.png')
    })

    it('parses --page for page navigation', () => {
      const options = parseScreenshotArgs(['--page', 'pages/index/index'])
      expect(options.page).toBe('pages/index/index')
    })

    it('parses --page=path style', () => {
      const options = parseScreenshotArgs(['--page=pages/index/index'])
      expect(options.page).toBe('pages/index/index')
    })

    it('parses -t for timeout', () => {
      const options = parseScreenshotArgs(['-t', '60000'])
      expect(options.timeout).toBe(60000)
    })

    it('parses --timeout for timeout', () => {
      const options = parseScreenshotArgs(['--timeout', '60000'])
      expect(options.timeout).toBe(60000)
    })

    it('parses --timeout=ms style', () => {
      const options = parseScreenshotArgs(['--timeout=60000'])
      expect(options.timeout).toBe(60000)
    })

    it('parses multiple options together', () => {
      const options = parseScreenshotArgs([
        '-p',
        '/my/project',
        '-o',
        'output.png',
        '--page',
        'pages/home/index',
        '-t',
        '45000',
      ])
      expect(options).toEqual({
        projectPath: '/my/project',
        outputPath: 'output.png',
        page: 'pages/home/index',
        timeout: 45000,
      })
    })

    it('ignores unknown flags', () => {
      const options = parseScreenshotArgs(['--unknown', 'value', '-p', '/project'])
      expect(options.projectPath).toBe('/project')
    })
  })
})
