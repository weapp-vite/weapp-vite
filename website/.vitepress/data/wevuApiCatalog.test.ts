import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPOSITION_API_E2E_NAMES } from '../../../e2e-apps/wevu-runtime-e2e/src/shared/compositionApiCoverage'
import { wevuApiCatalog } from './wevuApiCatalog'

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
