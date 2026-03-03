import { describe, expect, it } from 'vitest'
import { isSkippableResolvedId, normalizeFsResolvedId } from './resolvedId'

describe('resolvedId utils', () => {
  it('detects skippable resolved ids', () => {
    expect(isSkippableResolvedId(undefined)).toBe(true)
    expect(isSkippableResolvedId(null)).toBe(true)
    expect(isSkippableResolvedId('')).toBe(true)
    expect(isSkippableResolvedId('\0virtual')).toBe(true)
    expect(isSkippableResolvedId('node:path')).toBe(true)
    expect(isSkippableResolvedId('/project/src/index.ts')).toBe(false)
  })

  it('normalizes fs resolved id via normalizeViteId options', () => {
    const normalized = normalizeFsResolvedId('\0vue:file:///tmp/demo.ts?x=1', {
      stripLeadingNullByte: true,
    })

    expect(normalized).toContain('/tmp/demo.ts')
    expect(normalized).not.toContain('?')
  })
})
