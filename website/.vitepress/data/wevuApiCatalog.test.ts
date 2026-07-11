import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPOSITION_API_E2E_NAMES } from '../../../e2e-apps/wevu-runtime-e2e/src/shared/compositionApiCoverage'
import { getApiEntryHref, getCoreCategoryHref, resolveWevuApiNavigation, wevuApiCatalog, wevuCoreCategories } from './wevuApiCatalog'

const websiteRoot = path.resolve(import.meta.dirname, '../..')

function plainName(name: string) {
  return name.replace(/\(\)$/, '')
}

describe('wevu API catalog', () => {
  it('contains every API covered by the runtime e2e fixture', () => {
    const catalogNames = new Set(wevuApiCatalog.map(item => plainName(item.name)))

    for (const name of COMPOSITION_API_E2E_NAMES) {
      expect(catalogNames, `missing e2e-covered API ${name}`).toContain(name)
    }
  })

  it('keeps identifiers unique and covers macros and Options API', () => {
    const identifiers = wevuApiCatalog.map(item => `${item.entry}:${item.name}`)
    expect(new Set(identifiers).size).toBe(identifiers.length)

    const names = new Set(wevuApiCatalog.map(item => item.name))
    for (const macro of ['defineProps()', 'withDefaults()', 'defineEmits()', 'defineSlots()', 'defineExpose()', 'defineModel()', 'defineOptions()', 'definePageMeta()', 'defineAppSetup()']) {
      expect(names, `missing macro ${macro}`).toContain(macro)
    }
    for (const option of ['props', 'emits', 'data', 'setup', 'computed', 'methods', 'watch', 'properties', 'lifetimes', 'pageLifetimes', 'features', 'setData', 'setupLifecycle']) {
      expect(names, `missing option ${option}`).toContain(option)
    }
  })

  it('keeps the root, router, and store entry tabs populated', () => {
    for (const entry of ['wevu', 'wevu/router', 'wevu/store']) {
      expect(wevuApiCatalog.some(item => item.entry === entry), `empty entry tab ${entry}`).toBe(true)
    }
  })

  it('classifies every core API group exactly once', () => {
    const catalogGroups = new Set(wevuApiCatalog.filter(item => item.entry === 'wevu').map(item => item.group))
    const categoryGroups = wevuCoreCategories.flatMap(category => category.group ? [category.group] : [])

    expect(new Set(categoryGroups).size).toBe(categoryGroups.length)
    expect(new Set(categoryGroups)).toEqual(catalogGroups)
  })

  it('keeps entry and category URLs shareable', () => {
    expect(getApiEntryHref('core')).toBe('/wevu/api/')
    expect(getApiEntryHref('router')).toBe('/wevu/api/?entry=router')
    expect(getApiEntryHref('store')).toBe('/wevu/api/?entry=store')
    expect(getCoreCategoryHref('reactivity')).toBe('/wevu/api/?category=reactivity')

    expect(resolveWevuApiNavigation(new URL('https://example.test/wevu/api/?category=lifecycle'))).toEqual({
      category: 'lifecycle',
      entry: 'core',
    })
    expect(resolveWevuApiNavigation(new URL('https://example.test/wevu/api/?entry=router&category=lifecycle'))).toEqual({
      category: 'all',
      entry: 'router',
    })
    expect(resolveWevuApiNavigation(new URL('https://example.test/wevu/api/?category=unknown'))).toEqual({
      category: 'all',
      entry: 'core',
    })
  })

  it('covers the complete public Store surface', () => {
    const storeNames = new Set(wevuApiCatalog.filter(item => item.entry === 'wevu/store').map(item => item.name))
    const expectedNames = [
      'defineStore()',
      'createStore()',
      'storeToRefs()',
      '$id',
      '$state',
      '$patch()',
      '$reset()',
      '$subscribe()',
      '$onAction()',
      'manager.install()',
      'manager.use()',
      'state',
      'getters',
      'actions',
      'StoreManager',
      'DefineStoreOptions',
      'StoreToRefsResult',
      'ActionContext',
      'ActionSubscriber',
      'SubscriptionCallback',
      'StoreSubscribeOptions',
      'MutationType',
    ]

    expect(storeNames).toEqual(new Set(expectedNames))
  })

  it('links every catalog item to an existing page and explicit anchor', async () => {
    const sources = new Map<string, string>()
    for (const item of wevuApiCatalog) {
      const [pathname, anchor] = item.href.split('#')
      if (!pathname.startsWith('/wevu/')) {
        continue
      }
      const relativePath = pathname.endsWith('/') ? `${pathname}index.md` : `${pathname}.md`
      const sourcePath = path.join(websiteRoot, relativePath)
      const source = sources.get(sourcePath) || await fs.readFile(sourcePath, 'utf8')
      sources.set(sourcePath, source)
      if (anchor) {
        expect(source, `missing anchor ${item.href}`).toContain(`{#${anchor}}`)
      }
    }
  })
})
