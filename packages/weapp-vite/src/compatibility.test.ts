import { describe, expect, it } from 'vitest'
import { findWevuCompatibilityEntry, wevuCompatibilityCatalog } from './compatibility'

describe('wevuCompatibilityCatalog', () => {
  it('keeps compatibility identifiers unique per surface', () => {
    const ids = wevuCompatibilityCatalog.flatMap(item => item.surfaces.map(surface => `${item.upstream}:${item.api}:${surface}`))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('locks the requested compatibility conclusions', () => {
    expect(findWevuCompatibilityEntry('vue', 'hasInjectionContext', 'runtime')).toMatchObject({
      compatibility: 'supported',
      diagnostic: 'off',
    })
    expect(findWevuCompatibilityEntry('pinia', 'createPinia', 'runtime')).toMatchObject({
      compatibility: 'unsupported',
      diagnostic: 'error',
      replacement: expect.stringContaining('createStore'),
    })
    expect(findWevuCompatibilityEntry('vue-router', '<router-link>', 'template')).toMatchObject({
      compatibility: 'unsupported',
      diagnostic: 'error',
      replacement: expect.stringContaining('router.push'),
    })
  })

  it('records WeChat support separately from experimental platforms for SFC styles', () => {
    const sfcEntries = wevuCompatibilityCatalog.filter(item => item.surfaces.includes('sfc-style'))
    expect(sfcEntries.map(item => item.api)).toEqual(expect.arrayContaining([
      'CSS v-bind()',
      'scoped CSS',
      ':deep()',
      ':global()',
      ':slotted()',
      'CSS Modules',
      'useCssModule()',
    ]))
    expect(sfcEntries.every(item => item.platforms?.weapp === 'stable')).toBe(true)
    expect(sfcEntries.every(item => item.platforms?.other === 'experimental')).toBe(true)
  })
})
