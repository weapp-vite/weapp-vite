import { describe, expect, it } from 'vitest'
import { isSkippableResolvedId, normalizeFsResolvedId } from './resolvedId'

describe('resolved id utils', () => {
  it('detects skippable ids', () => {
    expect(isSkippableResolvedId(undefined)).toBe(true)
    expect(isSkippableResolvedId(null)).toBe(true)
    expect(isSkippableResolvedId('')).toBe(true)
    expect(isSkippableResolvedId('\0virtual:foo')).toBe(true)
    expect(isSkippableResolvedId('node:fs')).toBe(true)
    expect(isSkippableResolvedId('/a/b.ts')).toBe(false)
  })

  it('normalizes vue virtual and query for fs', () => {
    expect(normalizeFsResolvedId('\0vue:/a/b.vue?vue&type=script')).toBe('/a/b.vue')
  })
})
