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
})
