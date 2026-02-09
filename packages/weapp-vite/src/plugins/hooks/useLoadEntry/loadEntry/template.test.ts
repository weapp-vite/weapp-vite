import { describe, expect, it } from 'vitest'
import { collectVueTemplateAutoImportTags } from './template'

describe('collectVueTemplateAutoImportTags', () => {
  it('collects PascalCase and kebab-case tags', () => {
    const tags = collectVueTemplateAutoImportTags(
      '<Navbar /><nav-bar /><t-button />',
      'index.vue',
    )

    expect(tags.has('Navbar')).toBe(true)
    expect(tags.has('nav-bar')).toBe(true)
    expect(tags.has('t-button')).toBe(true)
  })

  it('does not collect single-word lowercase tags', () => {
    const tags = collectVueTemplateAutoImportTags(
      '<navbar /><hello-world />',
      'index.vue',
    )

    expect(tags.has('navbar')).toBe(false)
    expect(tags.has('hello-world')).toBe(true)
  })
})
