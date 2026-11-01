import { describe, expect, it } from 'vitest'
import { analyzeScript, getScriptTemplateExports } from './index'

function analyze(source: string) {
  return analyzeScript(source, 'consumer.sjs.ts', { platform: 'swan' })
}

describe('cross-module script symbol facts', () => {
  it('records default, named, namespace and static namespace-alias bindings with UTF-16 ranges', () => {
    const source = 'const emoji = "😀"; import tools, { foo as localFoo, bar } from "./tools.sjs"; import * as ns from "./tools.sjs"; const alias = ns; tools.foo(); ns["bar"](); alias.baz(); localFoo.nested; bar()'
    const result = analyze(source)
    expect(result.valid).toBe(true)
    expect(result.imports.map(binding => [binding.localName, binding.imported, binding.kind, source.slice(binding.start, binding.end)])).toEqual([
      ['tools', 'default', 'default', 'tools'],
      ['localFoo', 'foo', 'named', 'localFoo'],
      ['bar', 'bar', 'named', 'bar'],
      ['ns', '*', 'namespace', 'ns'],
      ['alias', '*', 'namespace', 'alias'],
    ])
    expect(result.externalUses.filter(use => use.kind === 'member').map(use => [use.imported, source.slice(use.start, use.end)])).toEqual([['foo', 'foo'], ['bar', 'bar'], ['baz', 'baz']])
    expect(result.externalUses.some(use => use.imported === 'nested')).toBe(false)
    expect(result.externalUses.find(use => use.kind === 'binding' && use.localName === 'localFoo')).toMatchObject({ imported: 'foo', source: './tools.sjs' })
    expect(result.externalUses.filter(use => use.kind === 'binding').every(use => use.rename === undefined)).toBe(true)
  })

  it('exposes distinct local and public rename strategies for shorthand imports', () => {
    const source = 'import { foo, bar as localBar } from "./tools.sjs"; foo(); localBar()'
    const result = analyze(source)
    const imported = result.imports.find(binding => binding.localName === 'foo')!
    expect(imported.rename).toEqual({ kind: 'import-shorthand', localName: 'foo' })
    expect(imported.importedRange).toEqual({ start: imported.start, end: imported.end })
    expect(result.imports.find(binding => binding.localName === 'localBar')?.rename).toEqual({ kind: 'name' })
    expect(result.symbols.find(symbol => symbol.kind === 'declaration' && symbol.name === 'foo')?.rename).toEqual({ kind: 'import-shorthand', localName: 'foo' })
  })

  it('resolves require namespace aliases, destructuring and direct static members', () => {
    const source = 'const tools = require("./tools.sjs"); const alias = tools; const { foo: localFoo, bar = 1, ["quoted"]: q } = require("./tools.sjs"); const fn = require("./tools.sjs").run; alias[`format`](); localFoo(); bar(); q(); fn(); fn.nested; require("./tools.sjs")["direct"]()'
    const result = analyze(source)
    expect(result.imports.map(binding => [binding.localName, binding.imported])).toEqual([['tools', '*'], ['alias', '*'], ['localFoo', 'foo'], ['bar', 'bar'], ['q', 'quoted'], ['fn', 'run']])
    expect(result.imports.find(binding => binding.localName === 'bar')?.rename).toEqual({ kind: 'property-shorthand', localName: 'bar' })
    expect(result.imports.find(binding => binding.localName === 'localFoo')?.rename).toEqual({ kind: 'name' })
    expect(result.imports.find(binding => binding.localName === 'fn')?.importedRange).toEqual({ start: source.indexOf('.run') + 1, end: source.indexOf('.run') + 4 })
    expect(result.externalUses.filter(use => use.kind === 'member').map(use => [use.imported, source.slice(use.start, use.end)])).toEqual([['run', 'run'], ['format', 'format'], ['nested', 'nested'], ['direct', 'direct']])
    expect(result.externalUses.find(use => use.imported === 'nested')?.targetPath).toEqual(['run', 'nested'])
  })

  it('respects shadowed require, imports, reassignment, dynamic keys and type-only references', () => {
    const source = 'import * as tools from "./tools.sjs"; import type { TypeOnly } from "./types.sjs"; import { type Other, real } from "./tools.sjs"; type T = typeof tools; tools[key]; const dynamic = require(path); dynamic.fake; function local(tools, require) { tools.fake; const x = require("./ignored.sjs"); x.fake; } let changing = require("./tools.sjs"); changing = other; changing.fake; real()'
    const result = analyze(source)
    expect(result.imports.map(binding => binding.localName)).toEqual(['tools', 'real'])
    expect(result.externalUses.some(use => ['fake', 'TypeOnly', 'Other', 'key'].includes(use.imported))).toBe(false)
    expect(result.externalUses.filter(use => use.source === './ignored.sjs')).toEqual([])
    expect(result.externalUses.filter(use => use.imported === '*').map(use => source.slice(use.start, use.end))).toEqual(['tools'])
  })

  it('records imported reexport names without changing public aliases', () => {
    const source = 'export { foo, bar as publicBar, default as callable } from "./tools.sjs"; export type { Value } from "./types.sjs"'
    const result = analyze(source)
    expect(result.externalUses).toEqual([
      expect.objectContaining({ source: './tools.sjs', imported: 'foo', localName: 'foo', kind: 'reexport', rename: { kind: 'import-shorthand', localName: 'foo' } }),
      expect.objectContaining({ source: './tools.sjs', imported: 'bar', localName: 'publicBar', kind: 'reexport', rename: { kind: 'name' } }),
      expect.objectContaining({ source: './tools.sjs', imported: 'default', localName: 'callable', kind: 'reexport', rename: { kind: 'name' } }),
    ])
    expect(result.externalUses.map(use => source.slice(use.start, use.end))).toEqual(['foo', 'bar', 'default'])
  })

  it('keeps all external facts empty after syntax failures', () => {
    const result = analyze('import { unfinished')
    expect(result.valid).toBe(false)
    expect(result.imports).toEqual([])
    expect(result.externalUses).toEqual([])
  })

  it('separates named, default-object and CommonJS exports that share the same public name', () => {
    const source = 'const named = 1, fallback = 2, native = 3; export { named as value }; export default { value: fallback }; module.exports = { value: native }'
    const exports = analyze(source).symbols.filter(symbol => symbol.kind === 'export')
    expect(exports.filter(symbol => symbol.name === 'value').map(symbol => symbol.exportScope)).toEqual(['named', 'default-member', 'commonjs'])
    expect(exports.find(symbol => symbol.name === 'default')?.exportScope).toBe('default')
    expect(new Set(exports.filter(symbol => symbol.name === 'value').map(symbol => symbol.declaration?.start)).size).toBe(3)
  })

  it('preserves target scopes through namespace members, default members, aliases and destructuring', () => {
    const source = 'import tools, { value as named } from "./tools.sjs"; import * as ns from "./tools.sjs"; const native = require("./tools.sjs"); const alias = tools; const { value: unpacked } = tools; named(); tools.value; ns.value; native.value; alias.value; unpacked(); tools()'
    const result = analyze(source)
    expect(result.imports.map(binding => [binding.localName, binding.targetScope])).toEqual([['tools', 'default'], ['named', 'named'], ['ns', 'named'], ['native', 'commonjs'], ['alias', 'default'], ['unpacked', 'default-member']])
    expect(result.externalUses.filter(use => use.kind === 'member').map(use => [use.localName, use.imported, use.targetScope])).toEqual([['tools', 'value', 'default-member'], ['ns', 'value', 'named'], ['native', 'value', 'commonjs'], ['alias', 'value', 'default-member']])
    expect(result.externalUses.find(use => use.kind === 'binding' && use.localName === 'unpacked')?.targetScope).toBe('default-member')
  })

  it('recognizes default object members exported through a named default specifier', () => {
    const source = 'const value = 1; const api = { value }; export { api as default }'
    expect(analyze(source).symbols.filter(symbol => symbol.kind === 'export').map(symbol => [symbol.name, symbol.exportScope])).toEqual([['value', 'default-member'], ['default', 'default']])
  })

  it('maps compiled CommonJS template APIs without merging named and default-member namespaces', () => {
    const mixed = analyze('const named = 1, fallback = 2; export { named as value }; export default { value: fallback }')
    expect(getScriptTemplateExports(mixed, { platform: 'weapp' }).exports.map(entry => [entry.path, entry.targetScope])).toEqual([[['value'], 'named'], [['default'], 'default'], [['default', 'value'], 'default-member']])
    const defaultOnly = analyze('export default { value: 1 }')
    expect(getScriptTemplateExports(defaultOnly, { platform: 'weapp' }).exports.map(entry => [entry.path, entry.targetScope])).toEqual([[['value'], 'default-member'], [[], 'default']])
    const native = analyzeScript('module.exports = { value: 1 }', 'tools.wxs', { platform: 'weapp' })
    expect(getScriptTemplateExports(native, { platform: 'weapp' }).exports.map(entry => [entry.path, entry.targetScope])).toEqual([[['value'], 'commonjs']])
  })

  it('marks unverified native/ESM mixed namespaces as ambiguous instead of selecting a same-name export', () => {
    const source = 'export const value = 1; export default { value: 2 }'
    for (const platform of ['swan', 'ty', 'alipay'] as const) {
      const native = analyzeScript(source, 'tools.sjs', { platform })
      expect(getScriptTemplateExports(native, { platform })).toMatchObject({ exports: [], ambiguous: true })
    }
    const swan = analyzeScript('export default { value: 1 }', 'tools.sjs', { platform: 'swan' })
    expect(getScriptTemplateExports(swan, { platform: 'swan' }).exports.find(entry => entry.path[0] === 'value')?.targetScope).toBe('default-member')
  })

  it('preserves namespace.default member scopes through static chains and destructuring', () => {
    const source = 'import * as ns from "./tools.sjs"; ns.value; ns.default.value; ns["default"]["value"]; const { default: api } = ns; api.value; const value = ns.default.value; value()'
    const result = analyze(source)
    const members = result.externalUses.filter(use => use.kind === 'member')
    expect(members.filter(use => use.imported === 'value').map(use => use.targetScope)).toEqual(['named', 'default-member', 'default-member', 'default-member', 'default-member'])
    expect(members.filter(use => use.imported === 'default').every(use => use.targetScope === 'default' && use.rename === undefined)).toBe(true)
    expect(result.imports.find(binding => binding.localName === 'api')).toMatchObject({ imported: 'default', targetScope: 'default' })
    expect(result.imports.find(binding => binding.localName === 'api')?.rename).toBeUndefined()
    expect(result.imports.find(binding => binding.localName === 'value')?.targetScope).toBe('default-member')
  })

  it('exposes complete CommonJS paths for exact matching against compiled module exports', () => {
    const target = analyze('export const value = 1; export default { value: 2 }')
    const source = 'const api = require("./tools.sjs"); const nested = api.default; const { value: local } = nested; api.value; api.default.value; nested.value; local()'
    const result = analyze(source)
    const paths = result.externalUses.filter(use => use.kind === 'member').map(use => use.targetPath)
    expect(paths).toEqual([['default'], ['value'], ['default'], ['default', 'value'], ['default', 'value']])
    expect(result.imports.find(binding => binding.localName === 'local')?.targetPath).toEqual(['default', 'value'])
    const exported = getScriptTemplateExports(target, { platform: 'weapp' }).exports
    expect(result.externalUses.filter(use => use.kind === 'member' && use.imported === 'value').map(use => exported.find(entry => JSON.stringify(entry.path) === JSON.stringify(use.targetPath))?.targetScope)).toEqual(['named', 'default-member', 'default-member'])
  })

  it('treats named default import spellings as the same default namespace without public default renames', () => {
    const source = 'import { default as tools } from "./tools.sjs"; import { "default" as quoted } from "./tools.sjs"; tools.value; quoted["value"]'
    const result = analyze(source)
    expect(result.imports.map(binding => [binding.localName, binding.imported, binding.targetScope, binding.rename])).toEqual([['tools', 'default', 'default', undefined], ['quoted', 'default', 'default', undefined]])
    expect(result.externalUses.filter(use => use.kind === 'member').map(use => [use.imported, use.targetScope])).toEqual([['value', 'default-member'], ['value', 'default-member']])
  })
})
