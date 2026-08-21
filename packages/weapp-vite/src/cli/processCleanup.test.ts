import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { terminateStaleSassEmbeddedProcess } from './processCleanup'

describe('terminateStaleSassEmbeddedProcess', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('kills only Sass embedded children and tolerates kill failures', () => {
    const killed = vi.fn()
    const failedKill = vi.fn(() => {
      throw new Error('already exited')
    })
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([
      { kill: killed, spawnfile: '/tools/sass-embedded' },
      { kill: failedKill, spawnfile: 'sass-embedded.cmd' },
      { kill: killed, spawnfile: '/tools/sass-embedded-darwin/dart-sass/src/dart', spawnargs: ['dart', 'sass.snapshot', '--embedded'] },
      { kill: vi.fn(), spawnfile: '/tools/node' },
      { spawnfile: '/tools/sass-embedded' },
      null,
    ])

    expect(() => terminateStaleSassEmbeddedProcess()).not.toThrow()
    expect(killed).toHaveBeenCalledTimes(2)
    expect(failedKill).toHaveBeenCalledTimes(1)
  })

  it('returns when active handle inspection is unavailable', () => {
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue(undefined)
    expect(terminateStaleSassEmbeddedProcess()).toBeUndefined()
  })
})
