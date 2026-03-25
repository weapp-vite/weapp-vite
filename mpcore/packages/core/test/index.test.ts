import { describe, expect, it } from 'vitest'
import { MPCORE_ECOSYSTEM, MPCORE_PACKAGE_NAME } from '../src'

describe('mpcore core package', () => {
  it('exposes the ecosystem package name', () => {
    expect(MPCORE_PACKAGE_NAME).toBe('mpcore')
    expect(MPCORE_ECOSYSTEM.packageName).toBe('mpcore')
  })
})
