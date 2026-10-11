import { describe, expect, it } from 'vitest'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../../ast/src/babel'
import { analyzeCompilerScriptsNative } from '../index.js'

describe('native compiler statement summaries', () => {
  it.each([
    'const value = 1',
    'export default { name: "Page" }',
    'export default { components: {} }',
    'export default { components: { Card, Named: Other, "custom-card": Card } }',
    'export default ({ components: ({ Card: (Other) }) });',
  ])('matches Babel registration facts for the proven static subset: %s', (code) => {
    const ast = parse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
    const expected: Array<{ name: string, local: string }> = []
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        const declaration = path.node.declaration
        if (declaration.type !== 'ObjectExpression') {
          return
        }
        for (const property of declaration.properties) {
          if (property.type !== 'ObjectProperty'
            || !((property.key.type === 'Identifier' && property.key.name === 'components')
              || (property.key.type === 'StringLiteral' && property.key.value === 'components'))
            || property.value.type !== 'ObjectExpression') {
            continue
          }
          for (const registration of property.value.properties) {
            if (registration.type === 'ObjectProperty' && registration.value.type === 'Identifier') {
              const key = registration.key
              if (key.type === 'Identifier' || key.type === 'StringLiteral') {
                expected.push({ name: key.type === 'Identifier' ? key.name : key.value, local: registration.value.name })
              }
            }
          }
        }
      },
    })
    expect(analyzeCompilerScriptsNative([{ code }])[0]?.registeredComponents).toEqual(expected)
  })

  it.each([
    'export default defineComponent({ components: { Card } })',
    'const options = { components: { Card } }; export default options',
    'export default Object.assign({}, { components: { Card } })',
    'export default { ...options, components: { Card } }',
    'export default { components: { ...registered, Card } }',
    'export default { [key]: true, components: { Card } }',
    'export default { components: {}, components: { Card } }',
    'export default { get components() { return { Card } } }',
    'export default { components: { Card, Card: Other } }',
    'export default { components: { [key]: Card } }',
    'export default { components: { Card() {} } }',
    'export default { components: { Card: import("./card") } }',
  ])('leaves complex registrations to the Babel fallback: %s', (code) => {
    const [summary] = analyzeCompilerScriptsNative([{ code }])
    expect(summary).not.toBeNull()
    expect(summary?.registeredComponents).toBeUndefined()
  })

  it.each([
    'defineOptions({ name: "plain" });',
    '// 😀 中文\r\nconst emoji = "🌞";\r\n(defineOptions({ name: "🌙" }));\r\ndefineOptions({})',
    '(defineOptions)({ name: "parenthesized callee" });',
    'defineOptions<{ name: string }>({ name: "generic" });',
    'function nested() { defineOptions({}) }; wrapper(defineOptions({})); defineOptions?.({}); void defineOptions({});',
    '(defineOptions({}) as object); (defineOptions({}) satisfies object); defineOptions({})!;',
    'defineOptions({});\u2028defineOptions({});\u2029defineOptions({})\r\ndefineOptions({})',
  ])('matches Babel statement boundaries exactly for %j', (code) => {
    const ast = parse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
    const expected: Array<{ start: number, end: number }> = []
    traverse(ast, {
      CallExpression(path) {
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'defineOptions'
          && path.parentPath.isExpressionStatement() && path.parentPath.parentPath?.isProgram()) {
          expected.push({ start: path.parentPath.node.start!, end: path.parentPath.node.end! })
        }
      },
    })
    const [summary] = analyzeCompilerScriptsNative([{ code, filename: 'component.ts' }])
    expect(summary).not.toBeNull()
    expect(summary?.defineOptionsStatements).toEqual(expected)
  })

  it('returns null per failed item without losing successful neighbors or input order', () => {
    const code = 'export default <view />'
    const results = analyzeCompilerScriptsNative([
      { code, filename: 'page.tsx' },
      { code, filename: 'page.ts' },
      { code: 'const =', filename: 'invalid.ts' },
      { code: 'export default {}', filename: 'other.ts' },
      { code, filename: 'page.tsx' },
    ])
    expect(results).toHaveLength(5)
    expect(results[0]?.hasDefaultExport).toBe(true)
    expect(results[1]).toBeNull()
    expect(results[2]).toBeNull()
    expect(results[3]?.hasDefaultExport).toBe(true)
    expect(results[4]).toEqual(results[0])
  })

  it.each(['\uD800', '\uDC00'])('rejects raw lone surrogates without losing valid neighbors: %j', (surrogate) => {
    const results = analyzeCompilerScriptsNative([
      { code: `defineOptions({ name: '${surrogate}' })` },
      { code: 'defineOptions({ name: "😀" })' },
    ])
    expect(results[0]).toBeNull()
    expect(results[1]?.defineOptionsName).toBe('😀')
  })

  it.each([
    String.raw`import Card from './\uD800.vue'`,
    String.raw`import { '\uDC00' as Card } from './card'`,
    String.raw`export { Card as '\uD800' } from './card'`,
    String.raw`export default { components: { '\uD800': Card } }`,
    String.raw`defineOptions({ name: '\uDC00' })`,
    String.raw`defineOptions({ '\uD800': 'value' })`,
  ])('rejects decoded lone-surrogate values per item: %s', (code) => {
    const valid = String.raw`import Card from './中文-\uD83D\uDE00.vue'; defineOptions({ name: '😀' }); export default { components: { '😀': Card } }`
    const results = analyzeCompilerScriptsNative([{ code }, { code: valid }, { code }])
    expect(results[0]).toBeNull()
    expect(results[2]).toBeNull()
    expect(results[1]?.imports[0]?.source).toBe('./中文-😀.vue')
    expect(results[1]?.defineOptionsName).toBe('😀')
    expect(results[1]?.registeredComponents).toEqual([{ name: '😀', local: 'Card' }])
  })
})
