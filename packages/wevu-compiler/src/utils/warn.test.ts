import { describe, expect, it, vi } from 'vitest'
import { resolveWarnHandler } from './warn'

describe('resolveWarnHandler', () => {
  it('returns provided warn handler when available', () => {
    const warn = vi.fn()
    const resolved = resolveWarnHandler(warn)
    resolved('hello')
    expect(warn).toHaveBeenCalledWith('hello')
  })

  it('falls back to console.warn when warn handler is missing', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveWarnHandler()
    resolved('fallback')
    expect(spy).toHaveBeenCalledWith('fallback')
    spy.mockRestore()
  })
})
