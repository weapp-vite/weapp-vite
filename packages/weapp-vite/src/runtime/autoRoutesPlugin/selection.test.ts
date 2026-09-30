import { describe, expect, it } from 'vitest'
import { selectPageSources, selectRouteCandidate } from './selection'

const candidate = {
  base: '/src/pages/index',
  files: new Set(['ts', 'js', 'vue', 'wxml', 'json', 'wxss'].map(extension => `/src/pages/index.${extension}`)),
  hasScript: true,
  hasTemplate: true,
  jsonPath: '/src/pages/index.json',
}

describe('auto routes physical source selection', () => {
  it.each([undefined, []])('preserves the default candidate for %j', (extensions) => {
    expect(selectRouteCandidate(candidate, extensions)).toBe(candidate)
    expect(selectPageSources(candidate, extensions)).toEqual(['/src/pages/index.ts', '/src/pages/index.js', '/src/pages/index.vue'])
  })

  it('keeps source priority independent of configuration order and preserves sidecars', () => {
    const selected = selectRouteCandidate(candidate, ['vue', 'js'])!
    expect(selectPageSources(selected)).toEqual(['/src/pages/index.js', '/src/pages/index.vue'])
    expect([...selected.files]).toEqual(expect.arrayContaining(['/src/pages/index.json', '/src/pages/index.wxml', '/src/pages/index.wxss']))
    expect(selected.files.has('/src/pages/index.ts')).toBe(false)
    expect(candidate.files.has('/src/pages/index.ts')).toBe(true)
  })

  it('excludes candidates without a matching extension', () => {
    expect(selectRouteCandidate(candidate, ['tsx'])).toBeUndefined()
  })
})
