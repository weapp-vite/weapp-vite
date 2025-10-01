import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAlias, createPathCompat, transformArgv } from '../src/utils'

const mockCwd = '/workspace/project'

describe('argv transforms', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
  })

  it('replaces alias and resolves relative project paths', () => {
    const argv = ['open', '-p', './mini-app']
    const result = transformArgv(argv, [
      createAlias({ find: '-p', replacement: '--project' }),
    ])

    expect(result).toEqual(['open', '--project', `${mockCwd}/mini-app`])
    expect(argv).toEqual(['open', '-p', './mini-app'])
  })

  it('injects current working directory when option value missing', () => {
    const argv = ['open', '-p']
    const result = transformArgv(argv, [
      createAlias({ find: '-p', replacement: '--project' }),
    ])

    expect(result).toEqual(['open', '--project', mockCwd])
  })

  it('normalises path-based options consistently', () => {
    const argv = ['open', '--qr-output', './dist/qr.png']
    const result = transformArgv(argv, [createPathCompat('--qr-output')])

    expect(result).toEqual([
      'open',
      '--qr-output',
      `${mockCwd}/dist/qr.png`,
    ])
  })
})
