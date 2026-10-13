import { describe, expect, it } from 'vitest'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../../ast/src/babel'
import { analyzeCompilerScriptsNative } from '../index.js'

describe('native compiler default export parity', () => {
  it.each([
    'export default {}',
    'const page = {}; export default page',
    'export default defineComponent({})',
    'export default function page() {}',
    'export default class Page {}',
    'const page: object = {}; export default (page satisfies object)',
    '// export default {}\nconst page = {}',
    'const label = "export default {}"',
    'const page = {}; export { page as default }',
    'declare module "virtual:card" { const page: any; export default page; }',
    'export/*comment*/default {}',
  ])('matches the existing Babel declaration check: %s', (code) => {
    let expected = false
    traverse(parse(code, BABEL_TS_MODULE_PARSER_OPTIONS), {
      ExportDefaultDeclaration(path) {
        expected = true
        path.stop()
      },
    })

    const results = analyzeCompilerScriptsNative([{ code, filename: 'page.ts' }, { code, filename: 'page.ts' }])

    expect(results[0]).not.toBeNull()
    expect(results[0]?.hasDefaultExport).toBe(expected)
    expect(results[1]?.hasDefaultExport).toBe(expected)
  })

  it('shares static registration facts while preserving the Options API method fallback', () => {
    const results = analyzeCompilerScriptsNative([
      { code: 'const title = "😀"; export default { setup: () => ({ title }) }', filename: 'page.ts' },
      { code: 'const title = "😀"; export default { setup() { return { title } } }', filename: 'page.ts' },
    ])

    expect(results[0]?.hasDefaultExport).toBe(true)
    expect(results[0]?.registeredComponents).toEqual([])
    expect(results[1]?.hasDefaultExport).toBe(true)
    expect(results[1]?.registeredComponents).toBeUndefined()
  })

  it('rejects recovered syntax per item and preserves successful neighbors', () => {
    const results = analyzeCompilerScriptsNative([
      { code: 'const value; export default {}', filename: 'page.ts' },
      { code: 'export default {}', filename: 'page.ts' },
      { code: 'export default =', filename: 'page.ts' },
    ])

    expect(results[0]).toBeNull()
    expect(results[1]?.hasDefaultExport).toBe(true)
    expect(results[2]).toBeNull()
  })
})
