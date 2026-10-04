import type { ScriptBaselineFeatures } from './state'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { optimizeScriptBaselineSource, scriptBaselineSources } from './source'

const all: ScriptBaselineFeatures = { astReuse: true, propsNoScope: true, pageMetaGate: true, reservedPropsGate: true }
const original = (filename: string) => readFileSync(new URL(`../../../${filename}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')

describe('script baseline source boundaries', () => {
  it.each(scriptBaselineSources)('fails closed when an enabled production source boundary changes: %s', (filename) => {
    expect(() => optimizeScriptBaselineSource(filename, '', all)).toThrow(/anchor changed/)
    expect(() => optimizeScriptBaselineSource(filename, original(filename), all)).not.toThrow()
  })

  it('keeps AST consumption after the existing fast setup return and never calls the lazy AST parser in the transfer', () => {
    const entry = optimizeScriptBaselineSource(scriptBaselineSources[0], original(scriptBaselineSources[0]), all)
    expect(entry).toContain('const existing = compiledScriptAst\n        compiledScriptAst = undefined')
    expect(entry).not.toContain('const existing = getCompiledScriptAst()')
    const transformed = optimizeScriptBaselineSource(scriptBaselineSources[3], original(scriptBaselineSources[3]), all)
    expect(transformed.indexOf('.takeAst(')).toBeGreaterThan(transformed.indexOf('return fastResult'))
  })

  it('does not insert the optional prefilters or AST handoff when those flags are off', () => {
    const disabled: ScriptBaselineFeatures = { astReuse: false, propsNoScope: false, pageMetaGate: false, reservedPropsGate: false }
    for (const filename of scriptBaselineSources.slice(1)) {
      expect(optimizeScriptBaselineSource(filename, original(filename), disabled)).toBe(original(filename))
    }
  })
})
