import type { ComponentStyleOptions } from 'wevu/compiler'
import type { StatefulHmrOutputFile } from './outputWriter'
import { describe, expect, it } from 'vitest'
import { resolveComponentPageGlobalStyleRoutes } from './componentPageStyles'

const applyShared: ComponentStyleOptions = {
  styleIsolation: { kind: 'known', value: 'apply-shared' },
  addGlobalClass: { kind: 'absent' },
}

function jsonAsset(route: string, config: unknown): StatefulHmrOutputFile {
  return { type: 'asset', fileName: `${route}.json`, source: JSON.stringify(config) }
}

describe('Component page global style dependencies', () => {
  it.each(['subPackages', 'subpackages'])('keeps %s independent pages outside main-app style inheritance', (key) => {
    expect(resolveComponentPageGlobalStyleRoutes([
      jsonAsset('app', { [key]: [{ root: 'independent/', independent: true }, { root: 'shared' }] }),
    ], new Map([
      ['independent/pages/index', applyShared],
      ['independent-other/pages/index', applyShared],
      ['shared/pages/index', applyShared],
    ]))).toEqual(['independent-other/pages/index', 'shared/pages/index'])
  })

  it.each(['isolated', 'shared', 'page-isolated', 'page-apply-shared', 'page-shared', '', null, false])(
    'honors final JSON override %j without falling back to JS options',
    (styleIsolation) => {
      expect(resolveComponentPageGlobalStyleRoutes(
        [jsonAsset('pages/home/index', { styleIsolation })],
        new Map([['pages/home/index', applyShared]]),
      )).toEqual([])
    },
  )

  it('uses known JS options only when JSON leaves isolation absent', () => {
    expect(resolveComponentPageGlobalStyleRoutes(
      [jsonAsset('pages/home/index', { navigationBarTitleText: 'Home' })],
      new Map([['pages/home/index', applyShared]]),
    )).toEqual(['pages/home/index'])
  })

  it('accepts final JSON apply-shared for a confirmed Component page with dynamic JS isolation', () => {
    expect(resolveComponentPageGlobalStyleRoutes(
      [jsonAsset('pages/home/index', { styleIsolation: 'apply-shared' })],
      new Map([['pages/home/index', { ...applyShared, styleIsolation: { kind: 'unknown' } }]]),
    )).toEqual(['pages/home/index'])
  })

  it('does not infer Component pages from JSON, nested components or addGlobalClass', () => {
    expect(resolveComponentPageGlobalStyleRoutes(
      [jsonAsset('components/card/index', { component: true, styleIsolation: 'apply-shared' })],
      new Map([['pages/home/index', {
        styleIsolation: { kind: 'absent' },
        addGlobalClass: { kind: 'known', value: true },
      }]]),
    )).toEqual([])
  })

  it('does not guess dynamic isolation from defaults', () => {
    expect(resolveComponentPageGlobalStyleRoutes([], new Map([['pages/home/index', {
      ...applyShared,
      styleIsolation: { kind: 'unknown' },
    }]]))).toEqual([])
  })

  it('rejects invalid final JSON instead of applying stale JS isolation', () => {
    expect(() => resolveComponentPageGlobalStyleRoutes([
      { type: 'asset', fileName: 'pages/home/index.json', source: '{' },
    ], new Map([['pages/home/index', applyShared]]))).toThrow()
    expect(() => resolveComponentPageGlobalStyleRoutes([
      jsonAsset('pages/home/index', null),
    ], new Map([['pages/home/index', applyShared]]))).toThrow('Invalid Component page JSON')
  })

  it('normalizes Windows route separators before matching final JSON', () => {
    expect(resolveComponentPageGlobalStyleRoutes(
      [jsonAsset('pages/home/index', { styleIsolation: 'page-isolated' })],
      new Map([['pages\\home\\index', applyShared]]),
    )).toEqual([])
  })
})
