import { describe, expect, it } from 'vitest'
import { collectScriptSetupImports, collectVueTemplateAutoImportTags } from './template'

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

describe('collectScriptSetupImports', () => {
  it('keeps babel and oxc results aligned', () => {
    const source = `
import type { FooProps } from './types'
import FooCard, { BarButton as RenamedButton, BazText } from './components'
import { IgnoredOnly } from './ignored'

const local = 1
`

    const templateComponentNames = new Set(['FooCard', 'RenamedButton', 'MissingTag'])

    expect(collectScriptSetupImports(source, templateComponentNames, { astEngine: 'babel' })).toEqual(
      collectScriptSetupImports(source, templateComponentNames, { astEngine: 'oxc' }),
    )
    expect(collectScriptSetupImports(source, templateComponentNames, { astEngine: 'oxc' })).toEqual([
      {
        localName: 'FooCard',
        importSource: './components',
        importedName: 'default',
        kind: 'default',
      },
      {
        localName: 'RenamedButton',
        importSource: './components',
        importedName: 'BarButton',
        kind: 'named',
      },
    ])
  })
})
