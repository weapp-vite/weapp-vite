import { describe, expect, it } from 'vitest'
import { analyzeCommonJson, collectComponentEntries } from './analyze'

describe('component dependency entries', () => {
  it('discovers a default-only generic without usingComponents', () => {
    expect(analyzeCommonJson({ component: true, componentGenerics: { item: { default: '../fallback/index' } } })).toEqual(['../fallback/index'])
  })
  it('deduplicates defaults and ordinary dependencies while ignoring unbound declarations', () => {
    expect(collectComponentEntries({
      usingComponents: { fallback: './fallback', ordinary: './ordinary' },
      componentGenerics: { item: { default: './fallback' }, another: { default: './another' }, unbound: true, empty: {} },
    })).toEqual(['./fallback', './ordinary', './another'])
  })
  it.each([null, {}, { componentGenerics: { invalid: { default: 1 }, empty: { default: '' } } }])('ignores non-path values: %j', (json) => {
    expect(collectComponentEntries(json)).toEqual([])
  })
})
