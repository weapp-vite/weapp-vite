import type { CapturedStageResult, CapturedWarning } from './captureTypes'
import { encode } from '@jridgewell/sourcemap-codec'
import { decodedMappings, originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { generate, parse } from '@weapp-vite/ast/babel'
import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { serializeCaptureValue } from './captureSerialize'
import { inspectTransform } from './transformOracle'

const filename = 'inline.ts'
function result(code: string, edit = new MagicString(code)): CapturedStageResult {
  return { code: edit.toString(), transformed: true, map: JSON.parse(edit.generateMap({ hires: true, includeContent: true, source: filename }).toString()) as unknown }
}
function warning(value: unknown[], channel: CapturedWarning['channel'] = 'handler'): CapturedWarning {
  return { channel, arguments: serializeCaptureValue(value) }
}
function compare(source: string, actual: string) {
  return inspectTransform({ code: source, transformed: true }, { code: actual, transformed: true }, source, [], [])
}

describe('complete native transform stage oracle', () => {
  it.each(['\u2028', '\u2029'])('accepts identical real Babel maps across Unicode separator %j', (separator) => {
    const source = `const first = 1;${separator}const second = 2;`
    const generated = generate(parse(source, { sourceType: 'module' }), { sourceMaps: true, sourceFileName: filename }, source)
    const stage = { code: generated.code, map: generated.map, transformed: true }
    const comparison = inspectTransform(stage, stage, source, [], [])
    expect(comparison).toMatchObject({ exactCode: true, exactMap: true, mapCoverageVerified: true, comparisonPassed: true })
    expect(comparison.mapMismatches).toEqual([])
  })

  it('preserves UTF-16 columns after both Unicode separators and CRLF and still rejects actual out-of-bounds origins', () => {
    const lastLine = '"😀"; target();'
    const source = `const first = 1;\u2028const second = 2;\u2029const third = 3;\r\n${lastLine}`
    const generated = generate(parse(source, { sourceType: 'module' }), { sourceMaps: true, sourceFileName: filename }, source)
    const stage = { code: generated.code, map: generated.map, transformed: true }
    const lastStatement = parse(generated.code, { sourceType: 'module' }).program.body.at(-1)
    if (!generated.map || lastStatement?.type !== 'ExpressionStatement' || lastStatement.expression.type !== 'CallExpression') {
      throw new Error('Expected the actual Babel map and final call expression')
    }
    const position = lastStatement.expression.callee.loc!.start
    const map = new TraceMap(generated.map)
    expect(originalPositionFor(map, position)).toEqual({ source: filename, line: 4, column: 6, name: null })
    expect(inspectTransform(stage, stage, source, [], [])).toMatchObject({ mapCoverageVerified: true, comparisonPassed: true })
    const mappings = structuredClone(decodedMappings(map))
    let changed = 0
    for (const line of mappings) {
      for (const segment of line) {
        if (segment.length >= 4 && segment[2] === 3 && segment[3] === 6) {
          segment[3] = lastLine.length + 1
          changed++
        }
      }
    }
    expect(changed).toBeGreaterThan(0)
    const outside = { ...stage, map: { ...generated.map, mappings: encode(mappings) } }
    const comparison = inspectTransform(outside, outside, source, [], [])
    expect(comparison).toMatchObject({ exactCode: true, exactMap: true, mapCoverageVerified: false, comparisonPassed: false })
    expect(comparison.mapMismatches).toContainEqual(expect.objectContaining({ reason: 'Origin is outside the shared input source', origin: { source: filename, line: 4, column: lastLine.length + 1, name: null } }))
  })

  it('uses the two independent output maps at matching paths, including Unicode and CRLF', () => {
    const source = 'const 标签=\"😀\";\r\nexport { 标签 };'
    const expected = result(source, new MagicString(source).prepend('generated();\n'))
    const changed = new MagicString(source).prepend('generated ();\n\n').appendLeft(source.indexOf('='), ' ').appendLeft(source.indexOf('=') + 1, ' ')
    const actual = result(source, changed)
    const comparison = inspectTransform(expected, actual, source, [], [])
    expect(comparison).toMatchObject({ exactCode: false, exactMap: false, astEqual: true, mapStatus: 'present-both', mapCoverageVerified: true, comparisonPassed: true })
    expect(comparison.tokens.matchedMapped).toBeGreaterThan(0)
    expect(comparison.tokens.bothUnmapped).toBe(2)
    expect(comparison.unmappedAnchors.every(anchor => anchor.classification === 'generated-or-injected-unmapped-candidate')).toBe(true)
  })

  it.each([
    ['true;', '!0;'],
    ['"text";', '`text`;'],
    ['const named = 1;', 'const renamed = 1;'],
    ['first(); second();', 'second(); first();'],
    ['"use strict"; value();', '"use sloppy"; value();'],
  ])('retains strict AST changes without semantic normalization: %s', (source, changed) => {
    const comparison = compare(source, changed)
    expect(comparison.astEqual).toBe(false)
    expect(comparison.astDifferences.length).toBeGreaterThan(0)
    expect(comparison.comparisonPassed).toBe(false)
  })

  it('preserves all structural differences instead of truncating a large mismatch', () => {
    const source = Array.from({ length: 100 }, (_, index) => `const value${index} = ${index};`).join('\n')
    const changed = Array.from({ length: 100 }, (_, index) => `const changed${index} = ${index + 1};`).join('\n')
    const comparison = compare(source, changed)
    expect(comparison.astDifferences).toHaveLength(200)
    expect(comparison.astDifferences.at(-1)).toMatchObject({ expected: 99, actual: 100 })
  })

  it('keeps comment contents, type and order exact', () => {
    expect(compare('/* first */ value(); /* second */', '/* second */ value(); /* first */').commentsEqual).toBe(false)
    expect(compare('/* first  value */ value();', '/* first value */ value();').commentsEqual).toBe(false)
    expect(compare('/* value */\nvalue();', '// value \nvalue();').commentsEqual).toBe(false)
  })

  it.each(['/* @__PURE__ */', '/* #__PURE__ */'])('detects moved %s attachments with unchanged AST and comments', (annotation) => {
    const source = `${annotation} first(); second();`
    const changed = `first(); ${annotation} second();`
    const comparison = compare(source, changed)
    expect(comparison).toMatchObject({ astEqual: true, commentsEqual: true, annotationsEqual: false, comparisonPassed: false })
    expect(comparison.annotationDifferences).toContainEqual(expect.objectContaining({ expected: 'leadingComments', actual: 'trailingComments' }))
    expect(comparison.annotationDifferences).toContainEqual(expect.objectContaining({ expectedPresent: false, actual: { path: '$.program.body[1]', nodeType: 'ExpressionStatement', placement: 'leadingComments' } }))
  })

  it('detects moved NO_SIDE_EFFECTS on declarations and arrow expressions', () => {
    for (const [source, changed] of [
      ['/* @__NO_SIDE_EFFECTS__ */ function first(){} function second(){}', 'function first(){} /* @__NO_SIDE_EFFECTS__ */ function second(){}'],
      ['const first=/* #__NO_SIDE_EFFECTS__ */()=>1;const second=()=>2;', 'const first=()=>1;const second=/* #__NO_SIDE_EFFECTS__ */()=>2;'],
    ]) {
      expect(compare(source!, changed!)).toMatchObject({ astEqual: true, commentsEqual: true, annotationsEqual: false, comparisonPassed: false })
    }
  })

  it('checks every result metadata field and distinguishes absent from undefined', () => {
    const source = 'value();'
    const expected = { code: source, transformed: true, runtimeCapabilities: undefined, custom: { flags: ['a', 'b'] } }
    const actual = { code: source, transformed: false, custom: { flags: ['b', 'a'] } }
    const comparison = inspectTransform(expected, actual, source, [], [])
    expect(comparison.metadataEqual).toBe(false)
    expect(comparison.metadataDifferences).toContainEqual({ path: '$.runtimeCapabilities', expected: undefined, actual: undefined, expectedPresent: true, actualPresent: false })
    expect(comparison.metadataDifferences).toHaveLength(4)
    expect(comparison.comparisonPassed).toBe(false)
  })

  it('preserves warning ordering, channels and complete argument lists', () => {
    const source = 'value();'
    const stage = { code: source, transformed: true }
    expect(inspectTransform(stage, stage, source, [warning(['first']), warning(['second'])], ['first', 'second']).warningsEqual).toBe(true)
    for (const expected of [[warning(['second']), warning(['first'])], [warning(['first'], 'console'), warning(['second'])], [warning(['first', { extra: 1 }]), warning(['second'])]]) {
      const comparison = inspectTransform(stage, stage, source, expected, ['first', 'second'])
      expect(comparison.warningsEqual).toBe(false)
      expect(comparison.warningDifferences.length).toBeGreaterThan(0)
      expect(comparison.comparisonPassed).toBe(false)
    }
  })

  it.each(['42;', '"value";', 'this;', 'const name = 1;'])('rejects two empty maps for source-derived anchors: %s', (source) => {
    const stage = result(source)
    stage.map = { version: 3, names: [], sources: [filename], sourcesContent: [source], mappings: '' }
    const comparison = inspectTransform(stage, stage, source, [], [])
    expect(comparison.mapCoverageVerified).toBe(false)
    expect(comparison.tokens.sourceCandidateUnmapped).toBeGreaterThan(0)
    expect(comparison.unmappedAnchors.every(anchor => anchor.classification === 'unmapped-source-candidate')).toBe(true)
    expect(comparison.comparisonPassed).toBe(false)
  })

  it('retains one-sided unmapped origins instead of dropping injected anchors', () => {
    const source = 'value();'
    const expected = result(source, new MagicString(source).prepend('injected();\n'))
    const actual = { ...expected, map: { version: 3, names: [], sources: [filename], sourcesContent: [source], mappings: 'AAAA;AAAA' } }
    const comparison = inspectTransform(expected, actual, source, [], [])
    expect(comparison.mapMismatches.some(item => item.reason === 'Independent stage origins differ')).toBe(true)
    expect(comparison.unmappedAnchors.length).toBeGreaterThan(0)
    expect(comparison.comparisonPassed).toBe(false)
  })

  it('rejects wrong source identity, one missing map, and origins outside input bounds', () => {
    const source = 'value();'
    const expected = result(source)
    for (const actual of [
      { ...expected, map: { ...(expected.map as object), sourcesContent: ['other();'] } },
      { ...expected, map: undefined },
      { ...expected, map: { ...(expected.map as object), mappings: 'AAgBA' } },
    ]) {
      const comparison = inspectTransform(expected, actual, source, [], [])
      expect(comparison.mapMismatches.length).toBeGreaterThan(0)
      expect(comparison.comparisonPassed).toBe(false)
    }
  })

  it('compares mapping names and resolved source identities', () => {
    const source = 'value();'
    const expected = result(source)
    for (const actual of [
      { ...expected, map: { ...(expected.map as object), mappings: 'AAAAA', names: ['different'] } },
      { ...expected, map: { ...(expected.map as object), sourceRoot: 'other-root' } },
    ]) {
      expect(inspectTransform(expected, actual, source, [], []).mapMismatches.some(item => item.reason === 'Independent stage origins differ')).toBe(true)
    }
  })

  it('reports absent maps without claiming origin coverage and preserves absent return shape', () => {
    const stage = { code: 'value();', transformed: true }
    expect(inspectTransform(stage, stage, stage.code, [], [])).toMatchObject({ mapStatus: 'absent-both', mapCoverageVerified: false, comparisonPassed: true })
    expect(inspectTransform(stage, { ...stage, map: null }, stage.code, [], []).comparisonPassed).toBe(false)
    expect(inspectTransform({ ...stage, map: undefined }, stage, stage.code, [], []).comparisonPassed).toBe(false)
  })
})
