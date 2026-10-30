import { describe, expect, it, vi } from 'vitest'
import { analyzeScript, findScriptClosingTag, findTrailingScriptComment, formatScript } from './script'

describe('platform script diagnostics', () => {
  it('accepts WXS module exports and its documented constructors', () => {
    const result = analyzeScript({ source: 'var value = getDate(0); module.exports = { value: value, re: getRegExp("a", "gim") }', fileName: 'tools.wxs' })
    expect(result).toMatchObject({ valid: true, dialect: 'wxs', sourceKind: 'native', diagnostics: [] })
  })

  it('accepts the documented WXS trailing block comment without a synthetic diagnostic', () => {
    const source = 'module.exports = { value: 1 };\n/* all remaining source is a comment\nvar x = "unfinished'
    expect(analyzeScript(source, 'tools.wxs').diagnostics).toEqual([])
    expect(findTrailingScriptComment(source)).toBe(source.indexOf('/*'))
    expect(analyzeScript(source, 'tools.sjs', { platform: 'alipay' }).valid).toBe(false)
  })

  it('does not treat comment markers in strings, regexes or templates as trailing comments', () => {
    // eslint-disable-next-line no-template-curly-in-string -- 测试数据包含待分析脚本的模板字面量。
    for (const source of ['var x = "/*"', 'var x = /\\/\\*/', 'var x = `/* ${"/*"}`', 'var x = 1 /* complete */']) {
      expect(findTrailingScriptComment(source)).toBeUndefined()
    }
  })

  it.each([
    ['import value from "./other.wxs"', 'script/wxs-module'],
    ['export default {}', 'script/wxs-module'],
    ['var date = new Date(0)', 'script/wxs-constructor'],
    ['var re = new RegExp("a")', 'script/wxs-constructor'],
    ['var re = /a/g', 'script/wxs-regexp'],
    ['var re = getRegExp("a", "u")', 'script/wxs-regexp-flags'],
    ['var re = getRegExp("a", "gg")', 'script/wxs-regexp-flags'],
    ['var other = require("package")', 'script/wxs-require'],
    ['var other = require("/other.wxs")', 'script/wxs-require'],
    ['var other = require("./other.js")', 'script/wxs-require'],
    ['wx.request({})', 'script/wxs-host-api'],
    ['window.document', 'script/wxs-host-api'],
  ])('reports a documented native WXS restriction: %s', (source, code) => {
    const result = analyzeScript(source, 'tools.wxs')
    expect(result.valid).toBe(false)
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toContain(code)
  })

  it('checks global references without flagging bindings, keys or type references', () => {
    const source = 'function run(wx, Date, require, getRegExp) { return new Date(wx.value) + require("package") + getRegExp("a", "u") }; module.exports = { wx: run }'
    expect(analyzeScript(source, 'tools.wxs').diagnostics).toEqual([])
    expect(analyzeScript('interface wx { request(): void }; type Page = wx; export const value: Page | null = null', 'tools.wxs.ts').diagnostics).toEqual([])
  })

  it('allows native relative WXS imports without guessing dynamic paths', () => {
    expect(analyzeScript('var one = require("../one.wxs"); var two = require(getPath())', 'tools.wxs').diagnostics).toEqual([])
  })

  it('does not diagnose a direct typeof capability probe as a runtime API access', () => {
    expect(analyzeScript('module.exports = { available: typeof wx !== "undefined" }', 'tools.wxs').diagnostics).toEqual([])
    expect(analyzeScript('module.exports = { available: typeof wx.request !== "undefined" }', 'tools.wxs').diagnostics.map(diagnostic => diagnostic.code)).toContain('script/wxs-host-api')
  })

  it('supports the documented Kuaishou KS CommonJS example without WXS syntax restrictions', () => {
    const source = 'const { label } = require("./index2.ks"); module.exports = { label, date: new Date(0), pattern: /a/u }'
    const result = analyzeScript(source, 'tools.ks', { platform: 'ks' })
    expect(result).toMatchObject({ valid: true, dialect: 'ks', sourceKind: 'native' })
    expect(result.references.map(reference => reference.source)).toEqual(['./index2.ks'])
    expect(analyzeScript('module.exports = require("./other.wxs")', 'tools.ks').diagnostics).toEqual([])
  })

  it.each(['tools.wxs.ts', 'tools.wxs.js'])('keeps build source syntax separate from native WXS: %s', (fileName) => {
    const source = fileName.endsWith('.ts') ? 'export const value: Date = new Date(0)' : 'export const value = new Date(0)'
    expect(analyzeScript(source, fileName)).toMatchObject({ valid: true, sourceKind: 'compiled' })
  })

  it('accepts inline TypeScript when the caller supplies the source kind and language', () => {
    expect(analyzeScript('export const value: number = 1', 'page.wxml', { sourceKind: 'compiled', language: 'typescript', dialect: 'wxs' }).valid).toBe(true)
  })

  it('keeps SJS platform selection explicit and does not copy WXS restrictions', () => {
    const source = 'export default { value: new Date(0), re: /a/u }'
    expect(analyzeScript(source, 'tools.sjs', { platform: 'alipay' }).diagnostics).toEqual([])
    expect(analyzeScript(source, 'tools.sjs').diagnostics).toEqual([expect.objectContaining({ code: 'script/platform-required', severity: 'warning' })])
    expect(analyzeScript({ source, fileName: 'tools.sjs', options: { platform: 'alipay' } }).diagnostics).toEqual([])
  })

  it('preserves UTF-16 offsets for editor diagnostics', () => {
    const source = 'var label = "😀";\r\nwx.request({})'
    const diagnostic = analyzeScript(source, 'tools.wxs').diagnostics[0]!
    expect(source.slice(diagnostic.start, diagnostic.end)).toBe('wx')
  })

  it('returns syntax errors with offsets in the original source', () => {
    const source = 'var x = "unterminated'
    const diagnostic = analyzeScript(source, 'tools.wxs').diagnostics[0]!
    expect(diagnostic.code).toBe('script/syntax')
    expect(diagnostic.start).toBe(source.indexOf('"'))
    expect(diagnostic.end).toBeLessThanOrEqual(source.length)
  })

  it('shares static module references with editor and project analysis', () => {
    const source = 'import value from "./value.sjs"; export { other } from "./other.sjs"; var data = require("./data.sjs"); function local(require) { return require("ignored") }'
    const result = analyzeScript(source, 'tools.sjs', { platform: 'alipay' })
    expect(result.references.map(reference => [reference.source, reference.kind, source.slice(reference.start, reference.end)])).toEqual([
      ['./value.sjs', 'import', './value.sjs'],
      ['./other.sjs', 'export', './other.sjs'],
      ['./data.sjs', 'require', './data.sjs'],
    ])
  })

  it('shares declarations, bound references and CommonJS export property locations', () => {
    const source = 'function label(value) { return value }; module.exports = { label: label }; module.exports.answer = label'
    const symbols = analyzeScript(source, 'tools.wxs').symbols
    const declaration = symbols.find(symbol => symbol.kind === 'declaration' && symbol.name === 'label')!
    const exported = symbols.filter(symbol => symbol.kind === 'export')
    expect(exported.map(symbol => symbol.name)).toEqual(['label', 'answer'])
    expect(exported.map(symbol => symbol.declaration)).toEqual([{ start: declaration.start, end: declaration.end }, { start: declaration.start, end: declaration.end }])
    expect(symbols.some(symbol => symbol.kind === 'reference' && symbol.name === 'label' && symbol.declaration?.start === declaration.start)).toBe(true)
  })

  it('resolves static default export objects and named ESM exports', () => {
    const source = 'function label(value) { return value }; const api = { label }; export default api; export { label as title }; export const count = 1'
    const names = analyzeScript(source, 'tools.sjs', { platform: 'alipay' }).symbols.filter(symbol => symbol.kind === 'export').map(symbol => symbol.name)
    expect(names).toEqual(['label', 'default', 'title', 'count'])
  })

  it('does not mistake shadowed module or exports bindings for exported APIs', () => {
    const source = 'function local(module, exports) { module.exports = { fake: 1 }; exports.other = 2 }; module.exports = { actual: 3 }'
    expect(analyzeScript(source, 'tools.wxs').symbols.filter(symbol => symbol.kind === 'export').map(symbol => symbol.name)).toEqual(['actual'])
  })

  it('keeps quoted export name ranges inside their original quotes for editor renames', () => {
    const source = 'module.exports = { "label": function (value) { return value } }; module.exports["answer"] = 42'
    const exported = analyzeScript(source, 'tools.wxs').symbols.filter(symbol => symbol.kind === 'export')
    expect(exported.map(symbol => source.slice(symbol.start, symbol.end))).toEqual(['label', 'answer'])
  })

  it('exposes AST-based rename metadata for local and public shorthand names', () => {
    const source = 'const foo = 1; const api = { foo }; export { foo }; export function label() { return foo }; export default api'
    const result = analyzeScript(source, 'tools.sjs', { platform: 'ty' })
    expect(result.symbols.filter(symbol => symbol.kind === 'export' && symbol.name === 'foo').map(symbol => symbol.rename?.kind)).toEqual(['property-shorthand', 'export-shorthand'])
    expect(result.symbols.find(symbol => symbol.kind === 'export' && symbol.name === 'label')?.rename).toEqual({ kind: 'binding', localName: 'label' })
    expect(result.symbols.find(symbol => symbol.kind === 'export' && symbol.name === 'default')?.rename).toBeUndefined()
    expect(result.symbols.filter(symbol => symbol.kind === 'reference' && symbol.name === 'foo').map(symbol => symbol.rename?.kind)).toEqual(['property-shorthand', 'export-shorthand', 'name'])
  })

  it('exposes binding renames for destructured exports without changing their property names', () => {
    const result = analyzeScript('export const { foo = 1, value: renamed } = input', 'tools.sjs', { platform: 'swan' })
    expect(result.symbols.filter(symbol => symbol.kind === 'export').map(symbol => [symbol.name, symbol.rename?.kind])).toEqual([['foo', 'binding'], ['renamed', 'binding']])
    expect(result.symbols.find(symbol => symbol.kind === 'declaration' && symbol.name === 'foo')?.rename?.kind).toBe('property-shorthand')
  })
})

describe('script block lexical boundaries', () => {
  it.each([
    'var marker = "</wxs>";',
    'var marker = \'</wxs>\';',
    'var marker = /<\\/wxs>/;',
    'var marker = /[<\\/wxs>]/;',
    // eslint-disable-next-line no-template-curly-in-string -- 测试数据包含待分析脚本的嵌套模板字面量。
    'var marker = `literal </wxs> ${"</wxs>"} ${`nested </wxs>`}`;',
    '/* fake </wxs> */ var marker = 1;',
    '// fake </wxs>\nvar marker = 1;',
    'var quotient = 8 / 2 / 2; var marker = "</wxs>";',
    'if (true) /<\\/wxs>/.test("x");',
    'var object = { value: 8 }; var quotient = object.value / 2;',
  ])('skips pseudo closing tags: %s', (script) => {
    const source = `<wxs>${script}</wxs><view />`
    expect(findScriptClosingTag(source, 5, 'wxs')).toEqual({ start: source.lastIndexOf('</wxs>'), end: source.lastIndexOf('</wxs>') + 6 })
  })

  it('accepts a WXS trailing comment before its actual closing tag', () => {
    const source = '<wxs>module.exports = {}; /* remaining comment </wxs><view />'
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.indexOf('</wxs>'))
  })

  it.each([
    '<wxs>module.exports = {}; // tail </wxs><view />',
    '<wxs>module.exports = {}; // tail </wxs>\n<view /><wxs>var other = 1</wxs>',
    '<wxs>module.exports = {}; /* tail </wxs>\n<view>*/</view><wxs>var other = 1</wxs>',
  ])('keeps a final comment inside its owning block: %s', (source) => {
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.indexOf('</wxs>'))
  })

  it('handles tag names case-insensitively and preserves complete tag ranges', () => {
    const source = '<sjs>export default {};</SJS  ><view />'
    const range = findScriptClosingTag(source, 5, 'sjs')!
    expect(source.slice(range.start, range.end)).toBe('</SJS  >')
    expect(findScriptClosingTag('<wxs>"missing"', 5, 'wxs')).toBeUndefined()
  })
})

describe('injected script formatting', () => {
  it('formats with a virtual JS path and enforces native WXS print constraints', async () => {
    const format = vi.fn(() => ({ code: 'var n = 1\nmodule.exports = { n: n }\n' }))
    const result = await formatScript('var n=1;module.exports={n:n}', 'tools.wxs', { format })
    expect(result).toMatchObject({ changed: true, diagnostics: [] })
    expect(format).toHaveBeenCalledWith('tools.wxs.js', expect.any(String), { trailingComma: 'none', embeddedLanguageFormatting: 'off' })
  })

  it('restores every byte of a native WXS trailing comment', async () => {
    const source = 'var n=1;/* original  tail\r\n untouched'
    const result = await formatScript(source, 'tools.wxs', {
      format: (_name, input) => {
        expect(input).toBe(`${source}*/`)
        return { code: 'var n = 1\n/* original  tail\r\n untouched*/\n' }
      },
    })
    expect(result.code).toBe('var n = 1\n/* original  tail\r\n untouched')
    expect(result.diagnostics).toEqual([])
  })

  it('checks TypeScript structure while keeping native-only restrictions disabled', async () => {
    const result = await formatScript('export const n:number=1', 'tools.wxs.ts', { format: () => ({ code: 'export const n: number = 1\n' }) })
    expect(result).toMatchObject({ changed: true, diagnostics: [] })
  })

  it('refuses changed semantics and preserves original bytes', async () => {
    const source = 'module.exports={value:1}'
    const result = await formatScript(source, 'tools.wxs', { format: () => ({ code: 'module.exports = { value: 2 }\n' }) })
    expect(result).toMatchObject({ code: source, changed: false, diagnostics: [expect.objectContaining({ code: 'script/unsafe-format' })] })
  })

  it('allows removal of redundant empty statements without changing empty loop bodies', async () => {
    const source = 'function label(n){return n+1};module.exports={label:label}'
    const result = await formatScript(source, 'tools.wxs', { format: () => ({ code: 'function label(n) { return n + 1 }\nmodule.exports = { label: label }\n' }) })
    expect(result.diagnostics).toEqual([])
    const loop = await formatScript('while (ready); module.exports = {}', 'tools.wxs', { format: () => ({ code: 'while (ready) { module.exports = {} }' }) })
    expect(loop.diagnostics.map(diagnostic => diagnostic.code)).toContain('script/unsafe-format')
  })

  it('does not invoke a formatter for invalid native code', async () => {
    const format = vi.fn(() => ({ code: '' }))
    const source = 'wx.request({})'
    expect((await formatScript(source, 'tools.wxs', { format })).code).toBe(source)
    expect(format).not.toHaveBeenCalled()
  })

  it('keeps formatter failures structured and non-mutating', async () => {
    const source = 'module.exports = {}'
    const result = await formatScript(source, 'tools.wxs', { format: () => ({ code: '', errors: [{ message: 'formatter unavailable' }] }) })
    expect(result).toMatchObject({ code: source, changed: false, diagnostics: [expect.objectContaining({ code: 'script/unsafe-format', message: 'formatter unavailable' })] })
  })
})
