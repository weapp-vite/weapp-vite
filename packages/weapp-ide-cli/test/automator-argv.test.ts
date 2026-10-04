import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAutomatorArgs, readBooleanOption, readOptionValue, removeOption } from '../src/cli/automator-argv'

describe('automator argv helpers', () => {
  const mockCwd = '/workspace/demo'
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
  })

  it.each(['0', '-1', 'NaN', 'Infinity', '1.5', '22001junk', '65536', '', '1e3', '0x50'])('rejects invalid --port %j instead of changing the target', (value) => {
    expect(() => parseAutomatorArgs(['--port', value])).toThrow(/port[^\n\r1\u2028\u2029]*1.*65535/i)
    expect(() => parseAutomatorArgs([`--port=${value}`])).toThrow(/port[^\n\r1\u2028\u2029]*1.*65535/i)
  })

  it('rejects a missing port value and accepts both port boundaries', () => {
    expect(() => parseAutomatorArgs(['--port'])).toThrow(/port/i)
    expect(parseAutomatorArgs(['--port=1']).port).toBe(1)
    expect(parseAutomatorArgs(['--port', '65535']).port).toBe(65535)
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

  it('parses explicit automator session options', () => {
    const parsed = parseAutomatorArgs([
      '--project',
      '/tmp/project',
      '--port',
      '19510',
      '--session-id=worker-a',
    ])

    expect(parsed).toEqual({
      projectPath: '/tmp/project',
      port: 19510,
      sessionId: 'worker-a',
      json: false,
      positionals: [],
    })
  })

  it('disables opened session reuse when runtime service is skipped', () => {
    const parsed = parseAutomatorArgs([
      '--project',
      '/tmp/project',
      '--no-runtime-service',
      '#button',
    ])

    expect(parsed).toEqual({
      projectPath: '/tmp/project',
      preferOpenedSession: false,
      json: false,
      positionals: ['#button'],
    })
  })

  it('reads option values from both forms', () => {
    expect(readOptionValue(['--output', 'a.json'], '--output')).toBe('a.json')
    expect(readOptionValue(['--output=b.json'], '--output')).toBe('b.json')
    expect(readOptionValue(['-o', 'c.json'], '--output', '-o')).toBe('c.json')
    expect(readOptionValue(['--output'], '--output')).toBeUndefined()
  })

  it('reads boolean options from bare flags and explicit values', () => {
    expect(readBooleanOption(['--isDistribute'], '--isDistribute')).toBe(true)
    expect(readBooleanOption(['--isDistribute=true'], '--isDistribute')).toBe(true)
    expect(readBooleanOption(['--isDistribute', 'false'], '--isDistribute')).toBe(false)
    expect(readBooleanOption(['-u'], '--use-aab', '-u')).toBe(true)
    expect(readBooleanOption(['--use-aab=false'], '--use-aab')).toBe(false)
    expect(readBooleanOption([], '--isDistribute')).toBeUndefined()
  })

  it('removes option/value pairs and --option=value tokens', () => {
    expect(removeOption(['audit', '--output', 'a.json', '--json'], '--output')).toEqual(['audit', '--json'])
    expect(removeOption(['audit', '--output=b.json', '--json'], '--output')).toEqual(['audit', '--json'])
  })

  it('keeps next positional when removing boolean flags', () => {
    expect(removeOption(['remote', '--disable', 'pages/a'], '--disable')).toEqual(['remote', 'pages/a'])
  })
})

it('retains the selected CLI path without treating it as a navigation argument', () => {
  expect(parseAutomatorArgs(['--cli-path', 'stable-cli', '/pages/home'])).toMatchObject({ cliPath: 'stable-cli', positionals: ['/pages/home'] })
  expect(parseAutomatorArgs(['--cli-path=rc-cli', '/pages/home'])).toMatchObject({ cliPath: 'rc-cli', positionals: ['/pages/home'] })
})
