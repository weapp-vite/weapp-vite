import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAutomatorArgs, readOptionValue, removeOption } from '../src/cli/automator-argv'

describe('automator argv helpers', () => {
  const mockCwd = '/workspace/demo'
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
  })

  it('parses common automator options and positionals', () => {
    const parsed = parseAutomatorArgs([
      '--project',
      '/tmp/project',
      '--timeout=5000',
      '--json',
      'pages/index/index',
      '--output',
      'snapshot.png',
    ])

    expect(parsed).toEqual({
      projectPath: '/tmp/project',
      timeout: 5000,
      json: true,
      positionals: ['pages/index/index'],
    })
  })

  it('falls back to cwd when project value is omitted', () => {
    const parsed = parseAutomatorArgs(['--project'])

    expect(parsed.projectPath).toBe(mockCwd)
    expect(parsed.positionals).toEqual([])
  })

  it('reads option values from both forms', () => {
    expect(readOptionValue(['--output', 'a.json'], '--output')).toBe('a.json')
    expect(readOptionValue(['--output=b.json'], '--output')).toBe('b.json')
    expect(readOptionValue(['--output'], '--output')).toBeUndefined()
  })

  it('removes option/value pairs and --option=value tokens', () => {
    expect(removeOption(['audit', '--output', 'a.json', '--json'], '--output')).toEqual(['audit', '--json'])
    expect(removeOption(['audit', '--output=b.json', '--json'], '--output')).toEqual(['audit', '--json'])
  })

  it('keeps next positional when removing boolean flags', () => {
    expect(removeOption(['remote', '--disable', 'pages/a'], '--disable')).toEqual(['remote', 'pages/a'])
  })
})
