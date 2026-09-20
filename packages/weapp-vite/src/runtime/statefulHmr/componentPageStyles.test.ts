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
  it('includes native Page routes whose layout slots inherit app styles', () => {
    expect(resolveComponentPageGlobalStyleRoutes([
      jsonAsset('app', { pages: ['pages/home/index'] }),
      jsonAsset('pages/home/index', { usingComponents: { layout: '/components/layout/index' } }),
      { type: 'chunk', fileName: 'pages/home/index.js', code: 'Page({ data: { mode: "dark" } })', modules: {} },
    ], new Map())).toEqual(['pages/home/index'])
  })

  it('keeps native Page inheritance while excluding independent, Component and shadowed registrations', () => {
    const routes = ['component', 'shadowed', 'isolated', 'ordinary']
    expect(resolveComponentPageGlobalStyleRoutes([
      jsonAsset('app', { pages: routes, subPackages: [{ root: 'independent', independent: true, pages: ['index'] }] }),
      jsonAsset('isolated', { styleIsolation: 'page-isolated' }),
      { type: 'chunk', fileName: 'component.js', code: 'Component({})', modules: {} },
      { type: 'chunk', fileName: 'shadowed.js', code: 'function Page() {} Page({})', modules: {} },
      { type: 'chunk', fileName: 'isolated.js', code: 'Page({})', modules: {} },
      { type: 'chunk', fileName: 'ordinary.js', code: 'Page({})', modules: {} },
      { type: 'chunk', fileName: 'independent/index.js', code: 'Page({})', modules: {} },
    ], new Map())).toEqual(['isolated', 'ordinary'])
  })

  it.each(['subPackages', 'subpackages'])('keeps %s independent pages outside main-app style inheritance', (key) => {
    expect(resolveComponentPageGlobalStyleRoutes([
      jsonAsset('app', { [key]: [{ root: 'independent/', independent: true }, { root: 'shared' }] }),
    ], new Map([
      ['independent/pages/index', applyShared],
      ['independent-other/pages/index', applyShared],
      ['shared/pages/index', applyShared],
    ]))).toEqual(['independent-other/pages/index', 'shared/pages/index'])
  })

  it.each(['subPackages', 'subpackages'])('includes ordinary native pages from %s with normalized routes', (key) => {
    expect(resolveComponentPageGlobalStyleRoutes([
      jsonAsset('app', { [key]: [{ root: 'feature/', pages: ['pages\\home\\index'] }] }),
      { type: 'chunk', fileName: 'feature/pages/home/index.js', code: 'Page({})', modules: {} },
    ], new Map())).toEqual(['feature/pages/home/index'])
  })

  it('keeps normalized Component metadata authoritative when emitted helpers reference Page', () => {
    expect(resolveComponentPageGlobalStyleRoutes([
      jsonAsset('app', { pages: ['pages/home/index'] }),
      { type: 'chunk', fileName: 'pages/home/index.js', code: 'function createPage(options) { Page(options) } Component({})', modules: {} },
    ], new Map([['pages\\home\\index', { ...applyShared, styleIsolation: { kind: 'known', value: 'page-isolated' } }]]))).toEqual([])
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
