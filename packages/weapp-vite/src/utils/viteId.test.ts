import { describe, expect, it } from 'vitest'
import { normalizeViteId } from './viteId'

describe('normalizeViteId', () => {
  it('strips query by default', () => {
    expect(normalizeViteId('/a/b.ts?import')).toBe('/a/b.ts')
  })

  it('keeps query when disabled', () => {
    expect(normalizeViteId('/a/b.ts?import', { stripQuery: false })).toBe('/a/b.ts?import')
  })

  it('normalizes /@fs prefix', () => {
    expect(normalizeViteId('/@fs/Users/me/project/src/a.ts')).toBe('/Users/me/project/src/a.ts')
  })

  it('normalizes /@fs prefix for Windows drive letters', () => {
    expect(normalizeViteId('/@fs/C:/Users/me/project/src/a.ts')).toBe('C:/Users/me/project/src/a.ts')
  })

  it('strips vue virtual prefix when enabled', () => {
    expect(normalizeViteId('\0vue:/a/b.vue?vue&type=script', { stripVueVirtualPrefix: true })).toBe('/a/b.vue')
  })

  it('does not strip leading null byte by default', () => {
    expect(normalizeViteId('\0virtual:dep')).toBe('\0virtual:dep')
  })

  it('strips leading null byte when enabled', () => {
    expect(normalizeViteId('\0virtual:dep', { stripLeadingNullByte: true })).toBe('virtual:dep')
  })
})
