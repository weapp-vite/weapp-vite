import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import type { EncodedSourceMapLike } from '../../packages-runtime/wevu-compiler/src/utils/sourcemap'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import { encode } from '@jridgewell/sourcemap-codec'
import { decodedMappings, originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { composeSourceMaps } from '../../packages-runtime/wevu-compiler/src/utils/sourcemap'
import { inspectCompilerOutputs } from './compilerOracle'

const filename = 'src/pages/example.vue'
const source = '<script setup>\r\nconst 标签="😀";\r\nconst original=标签;\r\nvoid original;\r\n</script><template><view /></template>'
const scenario: ScriptScenario = { id: 'sfc-map-contract', kind: 'sfc', filename, source, options: { sourceMap: true } }

function fixture(format = false) {
  const upstream = new MagicString(source).remove(0, source.indexOf('\r\n') + 2).remove(source.indexOf('</script>'), source.length)
  const code = upstream.toString()
  const stage = new MagicString(code)
  for (const found of code.matchAll(/original/g)) {
    stage.overwrite(found.index!, found.index! + found[0].length, 'renamed', { storeName: true })
  }
  if (format) {
    stage.prepend('\n').appendLeft(code.indexOf('='), ' ').appendLeft(code.indexOf('=') + 1, ' ')
  }
  const map = (edit: MagicString, source: string) => JSON.parse(edit.generateMap({ source, includeContent: true, hires: true }).toString()) as EncodedSourceMapLike
  const scriptMap = composeSourceMaps(map(stage, 'inline.ts'), map(upstream, filename))!
  return { script: stage.toString(), scriptMap, template: '<view/>', config: { usingComponents: {} }, bindingManifest: { version: 1, bindings: [] }, style: { code: 'view{}' } }
}

function output(value: unknown, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ value, warnings: [], consoleWarnings: [], ...extra })
}

describe('complete compiler output oracle', () => {
  it('traces independently composed real maps through Unicode, CRLF, printing and renaming', () => {
    const expected = fixture()
    const actual = fixture(true)
    const map = new TraceMap(actual.scriptMap as EncodedSourceMap)
    const position = actual.script.indexOf('renamed')
    const prefix = actual.script.slice(0, position).split(/\r\n|\n/)
    expect(originalPositionFor(map, { line: prefix.length, column: prefix.at(-1)!.length })).toEqual({ source: filename, line: 3, column: 6, name: 'original' })
    expect(inspectCompilerOutputs(output(expected), output(actual), scenario)).toMatchObject({
      exactOutput: false,
      comparisonPassed: true,
      metadataEqual: true,
      warningsEqual: true,
      errorEqual: true,
      script: { astEqual: true, commentsEqual: true, annotationsEqual: true },
      maps: { exactMap: false, coverageVerified: true, anchorsEqual: true },
    })
  })

  it('retains every non-script field and warning/error difference', () => {
    const expected = fixture()
    const actual = { ...fixture(true), template: '<text/>', config: { usingComponents: { item: './item' } }, style: { code: 'view{color:red}' } }
    const result = inspectCompilerOutputs(output(expected, { warnings: ['one', 'two'] }), output(actual, { warnings: ['two', 'one'], consoleWarnings: ['console'] }), scenario)
    expect(result).toMatchObject({ comparisonPassed: false, metadataEqual: false, warningsEqual: false })
    expect(result.metadataDifferences.map(item => item.path)).toEqual(['$.value.template', '$.value.config.usingComponents.item', '$.value.style.code'])
    expect(result.warningDifferences).toHaveLength(4)
    expect(result.outputDifferences.some(item => item.path.startsWith('$.value.scriptMap'))).toBe(true)
  })

  it('does not omit any other top-level fields or confuse missing and null', () => {
    const result = inspectCompilerOutputs(output(fixture(), { diagnostics: null }), output(fixture()), scenario)
    expect(result).toMatchObject({ metadataEqual: false, comparisonPassed: false })
    expect(result.metadataDifferences).toEqual([{ path: '$.diagnostics', expected: null, actual: undefined, expectedPresent: true, actualPresent: false }])
  })

  it.each(['one-sided', 'both-empty', 'wrong-content', 'wrong-source', 'multiple-sources', 'wrong-name', 'out-of-bounds', 'invalid-generated'])('fails real map coverage for %s', (change) => {
    const expected = fixture()
    const actual = fixture(true)
    const map = actual.scriptMap
    if (change === 'one-sided' || change === 'both-empty') {
      map.mappings = ''
      if (change === 'both-empty') {
        expected.scriptMap.mappings = ''
      }
    }
    if (change === 'wrong-content') {
      map.sourcesContent = [source.replace('标签', '不同')]
    }
    if (change === 'wrong-source') {
      map.sources = ['unrelated.vue']
    }
    if (change === 'multiple-sources') {
      map.sources.push('expression.js')
      map.sourcesContent!.push('expression')
    }
    if (change === 'wrong-name') {
      map.names = map.names.map(name => name === 'original' ? 'anotherName' : name)
    }
    if (change === 'out-of-bounds' || change === 'invalid-generated') {
      const decoded = decodedMappings(new TraceMap(map as EncodedSourceMap)).map(line => [...line])
      if (change === 'out-of-bounds') {
        decoded[0] = [[0, 0, 0, 1000]]
      }
      else {
        decoded.push([[10000, 0, 0, 0]])
      }
      map.mappings = encode(decoded)
    }
    const result = inspectCompilerOutputs(output(expected), output(actual), scenario)
    expect(result).toMatchObject({ comparisonPassed: false, script: { astEqual: true }, maps: { coverageVerified: false, anchorsEqual: false } })
    expect(result.maps!.mismatches.length).toBeGreaterThan(0)
  })

  it('does not identify an unmapped generated token by a matching AST signature', () => {
    const value = fixture()
    value.script += 'renamed;'
    const result = inspectCompilerOutputs(output(value), output(value), scenario)
    expect(result).toMatchObject({ exactOutput: true, comparisonPassed: false, maps: { coverageVerified: false } })
    expect(result.maps!.unmappedAnchors).toContainEqual(expect.objectContaining({ classification: 'unverified-origin' }))
  })

  it('preserves disabled-map return shapes without claiming coverage', () => {
    const { scriptMap: _, ...value } = fixture()
    const disabled = { ...scenario, options: { sourceMap: false } } as ScriptScenario
    expect(inspectCompilerOutputs(output(value), output(value), disabled)).toMatchObject({ comparisonPassed: true, maps: { status: 'disabled-both', coverageVerified: false } })
    expect(inspectCompilerOutputs(output(value), output({ ...value, scriptMap: null }), disabled)).toMatchObject({ comparisonPassed: false, maps: { status: 'disabled-both' } })
    expect(inspectCompilerOutputs(output(value), output(value), scenario).comparisonPassed).toBe(false)
  })

  it('preserves exact comment text, type, order and PURE annotation ownership', () => {
    const before = fixture()
    const after = fixture()
    before.script += '/* @__PURE__ */ first(); second();'
    after.script += 'first(); /* @__PURE__ */ second();'
    expect(inspectCompilerOutputs(output(before), output(after), scenario)).toMatchObject({ comparisonPassed: false, script: { astEqual: true, commentsEqual: true, annotationsEqual: false } })
    after.script = after.script.replace('@__PURE__', '#__PURE__')
    expect(inspectCompilerOutputs(output(before), output(after), scenario).script?.commentsEqual).toBe(false)
  })

  it('keeps reserved-property and expected-error scenarios byte-exact', () => {
    const reserved: ScriptScenario = { id: 'reserved', kind: 'reserved-props', filename, source }
    const raw = output(undefined, { warnings: ['warning'] })
    expect(inspectCompilerOutputs(raw, raw, reserved).comparisonPassed).toBe(true)
    expect(inspectCompilerOutputs(raw, `${raw}\n`, reserved).comparisonPassed).toBe(false)
    const error = output(undefined, { error: { name: 'SyntaxError', message: 'bad', loc: { line: 2, column: 3 } } })
    expect(inspectCompilerOutputs(error, error, { ...scenario, expectError: true })).toMatchObject({ comparisonPassed: true, errorEqual: true })
    expect(inspectCompilerOutputs(error, error.replace('bad', 'different'), { ...scenario, expectError: true }).errorEqual).toBe(false)
    expect(inspectCompilerOutputs(output(fixture()), output(fixture()), { ...scenario, expectError: true }).comparisonPassed).toBe(false)
    expect(inspectCompilerOutputs(error, error, scenario).comparisonPassed).toBe(false)
  })

  it('reuses the existing strict transform oracle for raw scripts', () => {
    const code = 'const value = 1;'
    const raw: ScriptScenario = { id: 'script', kind: 'script', filename: 'example.ts', source: code, options: { sourceMap: true } }
    const map: unknown = JSON.parse(new MagicString(code).generateMap({ hires: true, includeContent: true, source: 'inline.ts' }).toString())
    const value = { code, transformed: true, map }
    expect(inspectCompilerOutputs(output(value), output(value), raw)).toMatchObject({ comparisonPassed: true, script: { comparisonPassed: true, mapCoverageVerified: true } })
    expect(inspectCompilerOutputs(output(value), output({ ...value, map: { ...(map as object), mappings: '' } }), raw).comparisonPassed).toBe(false)
    expect(inspectCompilerOutputs(output(value), output(value, { consoleWarnings: ['changed'] }), raw).comparisonPassed).toBe(false)
  })

  it('retains all differences and rejects malformed output even when both bytes agree', () => {
    const value = fixture()
    const before = { ...value, details: Array.from({ length: 120 }, (_, index) => index) }
    const after = { ...value, details: Array.from({ length: 120 }, (_, index) => index + 1) }
    expect(inspectCompilerOutputs(output(before), output(after), scenario).metadataDifferences).toHaveLength(120)
    for (const raw of ['invalid', '{}', '{"warnings":[{}],"consoleWarnings":[]}']) {
      expect(inspectCompilerOutputs(raw, raw, scenario)).toMatchObject({ exactOutput: true, comparisonPassed: false })
    }
    expect(inspectCompilerOutputs(output({ ...value, script: 'const =' }), output(value), scenario).issues).toContainEqual(expect.objectContaining({ reason: 'Cannot inspect complete compiler script' }))
  })
})
