import { describe, expect, it } from 'vitest'
import { hasDefaultExport } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/defaultExport'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../../ast/src/babel'
import { readNativeCompilerScriptAnalysis } from '../../ast/src/native/compilerAnalysis'
import { analyzeCompilerScriptsNative } from '../index.js'

describe('native compiler default export parity', () => {
  it.each([
    ['export default {}', true],
    ['const page = {}; export default page', true],
    ['export default defineComponent({})', true],
    ['export default function page() {}', true],
    ['export default class Page {}', true],
    ['const page: object = {}; export default (page satisfies object)', true],
    ['// export default {}\nconst page = {}', true],
    ['const label = "export default {}"', true],
    ['const page = {}; export { page as default }', true],
    ['declare module "virtual:card" { const page: any; export default page; }', false],
    ['export/*comment*/default {}', true],
  ] as const)('matches the existing Babel declaration check or explicitly falls back: %s', (code, supported) => {
    let expected = false
    traverse(parse(code, BABEL_TS_MODULE_PARSER_OPTIONS), {
      ExportDefaultDeclaration(path) {
        expected = true
        path.stop()
      },
    })

    const results = analyzeCompilerScriptsNative([
      { code, filename: 'page.ts' },
      { code, filename: 'page.ts' },
      { code: 'export default {}', filename: 'neighbor.ts' },
    ])

    if (supported) {
      expect(results[0]).not.toBeNull()
      expect(results[0]?.hasDefaultExport).toBe(expected)
      expect(results[1]?.hasDefaultExport).toBe(expected)
    }
    else {
      expect(expected).toBe(true)
      expect(results[0]).toBeNull()
      expect(results[1]).toBeNull()
      const summary = readNativeCompilerScriptAnalysis(results[0], code)
      expect(summary).toBeUndefined()
      expect(hasDefaultExport(code, summary)).toBe(expected)
    }
    expect(results[2]?.hasDefaultExport).toBe(true)
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
