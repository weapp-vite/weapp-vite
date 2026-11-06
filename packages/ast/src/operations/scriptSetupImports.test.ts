import { describe, expect, it } from 'vitest'
import { analyzeScriptSetupImportsFromCode, collectScriptSetupImportsFromCode } from './scriptSetupImports'

describe.each(['babel', 'oxc'] as const)('script setup import analysis (%s)', (astEngine) => {
  const names = new Set(['Card'])

  it('distinguishes complete empty results from failed and partial parses', () => {
    for (const source of [
      'const title = "no imports"',
      'import type Card from "./Card.vue"',
      'import Other from "./Other.vue"; const Card = Other',
    ]) {
      expect(analyzeScriptSetupImportsFromCode(source, names, { astEngine })).toEqual({ status: 'complete', imports: [] })
    }
    for (const source of [
      'import Card from',
      'import Card from "./Card.vue"; const broken =',
    ]) {
      expect(analyzeScriptSetupImportsFromCode(source, names, { astEngine })).toEqual({ status: 'failed', imports: [] })
      expect(collectScriptSetupImportsFromCode(source, names, { astEngine })).toEqual([])
    }
  })

  it('returns equivalent imports through the existing array API', () => {
    const source = 'import Card from "./Card.vue"'
    const result = analyzeScriptSetupImportsFromCode(source, names, { astEngine })
    expect(result.status).toBe('complete')
    expect(result.imports).toEqual([{ localName: 'Card', importSource: './Card.vue', importedName: 'default', kind: 'default' }])
    expect(collectScriptSetupImportsFromCode(source, names, { astEngine })).toEqual(result.imports)
  })
})
