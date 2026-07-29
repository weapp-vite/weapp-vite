import { afterEach, describe, expect, it, vi } from 'vitest'
import { emitRuntimeWarning, setRuntimeWarningOptions } from '../src/runtime/warning'

describe('runtime warning options', () => {
  afterEach(() => {
    setRuntimeWarningOptions()
    vi.restoreAllMocks()
  })

  it('dedupes warnings with the same key by default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    emitRuntimeWarning('[@weapp-vite/web] duplicated warning', {
      key: 'dup-test',
      context: 'runtime:test',
    })
    emitRuntimeWarning('[@weapp-vite/web] duplicated warning', {
      key: 'dup-test',
      context: 'runtime:test',
    })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('runtime:test')
  })

  it('can disable dedupe', () => {
    setRuntimeWarningOptions({ dedupe: false })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    emitRuntimeWarning('[@weapp-vite/web] no dedupe warning', { key: 'dup-test' })
    emitRuntimeWarning('[@weapp-vite/web] no dedupe warning', { key: 'dup-test' })

    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('supports off and error levels, plain messages and missing consoles', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    setRuntimeWarningOptions({ level: 'off' })
    emitRuntimeWarning('hidden')
    expect(warn).not.toHaveBeenCalled()

    setRuntimeWarningOptions({ level: 'error' })
    emitRuntimeWarning('plain message', { context: 'runtime:test' })
    expect(error).toHaveBeenCalledWith('[@weapp-vite/web][runtime:test] plain message')

    vi.stubGlobal('console', undefined)
    expect(() => emitRuntimeWarning('no console')).not.toThrow()
    vi.unstubAllGlobals()
  })

  it('falls back safely when console methods are unavailable', () => {
    const originalConsole = globalThis.console
    vi.stubGlobal('console', {} as Console)
    expect(() => emitRuntimeWarning('no warn')).not.toThrow()
    expect(() => emitRuntimeWarning('no error', { level: 'error' })).not.toThrow()
    vi.stubGlobal('console', originalConsole)
  })
})
