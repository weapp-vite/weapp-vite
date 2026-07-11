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
  it('uses the runtime fixture as the only source of verified API evidence', () => {
    const verifiedNames = wevuApiCatalog
      .filter(item => item.evidence === 'runtime-e2e')
      .map(item => plainName(item.name))
      .sort()

    expect(verifiedNames).toEqual([...COMPOSITION_API_E2E_NAMES].sort())
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
