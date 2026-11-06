import { describe, expect, it } from 'vitest'
import { ContentAnalysisCache } from './contentAnalysisCache'

const facts = { analysis: { hasPlatformApiAccess: true, hasStaticRequireLiteral: false } }

describe('content analysis cache', () => {
  it('separates exact source and parser engine', () => {
    const cache = new ContentAnalysisCache()
    cache.set('wx.request({})', 'oxc', facts)

    expect(cache.get('wx.request({})', 'oxc')).toBe(facts)
    expect(cache.get('wx.request({});', 'oxc')).toBeUndefined()
    expect(cache.get('wx.request({})', 'babel')).toBeUndefined()
  })

  it('separates parser filenames including the default parser input', () => {
    const cache = new ContentAnalysisCache()
    const code = 'await(wx).request()'
    cache.set(code, 'oxc', facts, 'shared.cjs')

    expect(cache.get(code, 'oxc', 'shared.cjs')).toBe(facts)
    expect(cache.get(code, 'oxc', 'shared.mjs')).toBeUndefined()
    expect(cache.get(code, 'oxc')).toBeUndefined()
  })

  it('evicts least recently consumed content and bounds oversized inputs', () => {
    const cache = new ContentAnalysisCache(2, 80)
    cache.set('first', 'oxc', facts)
    cache.set('second', 'oxc', facts)
    expect(cache.get('first', 'oxc')).toBe(facts)
    cache.set('third', 'oxc', facts)

    expect(cache.get('second', 'oxc')).toBeUndefined()
    expect(cache.get('first', 'oxc')).toBe(facts)
    expect(cache.get('third', 'oxc')).toBe(facts)
    cache.set('x'.repeat(100), 'oxc', facts)
    expect(cache.get('x'.repeat(100), 'oxc')).toBeUndefined()
    expect(cache.get('first', 'oxc')).toBe(facts)
  })

  it('enforces the total retained source budget across replacements', () => {
    const cache = new ContentAnalysisCache(10, 30)
    cache.set('12345', 'oxc', facts)
    cache.set('12345', 'oxc', facts)
    cache.set('67890', 'oxc', facts)

    expect(cache.get('12345', 'oxc')).toBeUndefined()
    expect(cache.get('67890', 'oxc')).toBe(facts)
  })
})
