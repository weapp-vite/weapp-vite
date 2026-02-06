import { describe, expect, it } from 'vitest'
import { getDefaultBuildTarget, sanitizeBuildTarget } from './targets'

describe('runtime/config/targets', () => {
  it('returns platform default build target for alipay', () => {
    expect(getDefaultBuildTarget('alipay')).toBe('es2015')
  })

  it('returns undefined default build target for weapp', () => {
    expect(getDefaultBuildTarget('weapp')).toBeUndefined()
  })

  it('keeps existing sanitize behavior', () => {
    expect(sanitizeBuildTarget('es5', { allowEs5: true }).sanitized).toBe('es2015')
    expect(sanitizeBuildTarget('es2020', { allowEs5: false }).sanitized).toBe('es2020')
  })
})
