import { describe, expect, it } from 'vitest'
import { getDefaultBuildTarget, isNonConcreteBuildTarget, sanitizeBuildTarget } from './targets'

describe('runtime/config/targets', () => {
  it('returns platform default build target for alipay', () => {
    expect(getDefaultBuildTarget('alipay')).toBe('es2015')
  })

  it('returns platform default build target for weapp', () => {
    expect(getDefaultBuildTarget('weapp')).toBe('es2018')
  })

  it('keeps existing sanitize behavior', () => {
    expect(sanitizeBuildTarget('es5', { allowEs5: true }).sanitized).toBe('es2015')
    expect(sanitizeBuildTarget('es2020', { allowEs5: false }).sanitized).toBe('es2020')
  })

  it('detects non-concrete build targets', () => {
    expect(isNonConcreteBuildTarget('modules')).toBe(true)
    expect(isNonConcreteBuildTarget('esnext')).toBe(true)
    expect(isNonConcreteBuildTarget('es2018')).toBe(false)
    expect(isNonConcreteBuildTarget(['modules', 'es2020'])).toBe(true)
  })
})
