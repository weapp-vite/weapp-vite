import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { inspectRoundTrip } from './oracle'

const filename = 'inline.js'
function unchanged(source: string) {
  const map = new MagicString(source).generateMap({ hires: true, includeContent: true, source: filename })
  return JSON.parse(map.toString()) as unknown
}

describe('native script printer oracle', () => {
  it('checks Unicode identifier positions and preserves an upstream map', () => {
    const input = 'const label = "😀"; const 数量 = 2;\r\nexport { 数量, label };'
    const result = inspectRoundTrip(input, input, unchanged(input), filename, unchanged(input))
    expect(result.comparisonPassed).toBe(true)
    expect(result.identifiers.matched).toBe(6)
    expect(result.identifiers.composed).toBe(6)
    expect(result.tokens.matched).toBeGreaterThan(result.identifiers.matched)
    expect(result.tokens.composed).toBe(result.tokens.original)
  })

  it('keeps byte differences separate from equivalent structure', () => {
    const input = 'const value=1;'
    const code = 'const value = 1;'
    const edited = new MagicString(input).appendLeft(11, ' ').appendLeft(12, ' ')
    const map = JSON.parse(edited.generateMap({ hires: true, includeContent: true, source: filename }).toString()) as unknown
    const result = inspectRoundTrip(input, code, map, filename)
    expect(result.exactCode).toBe(false)
    expect(result.comparisonPassed).toBe(true)
  })

  it('traces actual composed maps across source roots, changed lines and unmapped prefixes', () => {
    const original = 'const value = 1;'
    const stage = new MagicString(original).prepend('synthetic();\n')
    const input = stage.toString()
    const upstream = JSON.parse(stage.generateMap({ hires: true, includeContent: true, source: 'component.vue' }).toString()) as Record<string, unknown>
    upstream.sourceRoot = '../sources'
    const printed = new MagicString(input).prepend('\n\n')
    const map = JSON.parse(printed.generateMap({ hires: true, includeContent: true, source: filename }).toString()) as unknown
    const result = inspectRoundTrip(input, printed.toString(), map, filename, upstream)
    expect(result.comparisonPassed).toBe(true)
    expect(result.identifiers.composed).toBe(2)
    expect(result.identifiers.upstreamUnmapped).toBe(1)
    expect(result.tokens.composed).toBe(result.tokens.original)
    expect(result.tokens.upstreamUnmapped).toBe(2)
  })

  it.each(['42;', '"text";', 'true;', 'null;', '1n;', '/value/u;', '`😀`;', 'this;', '[];', '{}'])('rejects an empty map for a program without identifiers: %s', (input) => {
    const result = inspectRoundTrip(input, input, { version: 3, sources: [filename], sourcesContent: [input], names: [], mappings: '' }, filename)
    expect(result.identifiers.original).toBe(0)
    expect(result.tokens.original).toBeGreaterThan(0)
    expect(result.tokens.matched).toBe(0)
    expect(result.mapMismatches).not.toHaveLength(0)
    expect(result.comparisonPassed).toBe(false)
  })

  it('checks statement and literal positions as well as identifiers', () => {
    const input = 'function value() { if (true) { return 42; } throw null; }'
    const result = inspectRoundTrip(input, input, unchanged(input), filename)
    expect(result.comparisonPassed).toBe(true)
    expect(result.identifiers.original).toBe(1)
    expect(result.tokens.original).toBeGreaterThan(result.identifiers.original)
    expect(result.tokens.matched).toBe(result.tokens.original)
  })

  it.each(['/* @__PURE__ */', '/* #__PURE__ */'])('rejects moving %s to another call even when comment order and all origins match', (annotation) => {
    const input = `${annotation} first(); second();`
    const printed = new MagicString(input).move(0, input.indexOf('first'), input.indexOf('second'))
    const map = JSON.parse(printed.generateMap({ hires: true, includeContent: true, source: filename }).toString()) as unknown
    const result = inspectRoundTrip(input, printed.toString(), map, filename)
    expect(result.astEqual).toBe(true)
    expect(result.commentsEqual).toBe(true)
    expect(result.tokens.matched).toBe(result.tokens.original)
    expect(result.mapMismatches).toEqual([])
    expect(result.annotationsEqual).toBe(false)
    expect(result.annotationDifferences).toMatchObject({
      original: [{ attachments: [{ path: '$.program.body[0]', placement: 'leadingComments' }] }],
    })
    expect(result.comparisonPassed).toBe(false)
  })

  it('rejects moving NO_SIDE_EFFECTS between function declarations', () => {
    const input = '/* @__NO_SIDE_EFFECTS__ */ function first() {} function second() {}'
    const printed = new MagicString(input).move(0, input.indexOf('function'), input.indexOf('function second'))
    const map = JSON.parse(printed.generateMap({ hires: true, includeContent: true, source: filename }).toString()) as unknown
    const result = inspectRoundTrip(input, printed.toString(), map, filename)
    expect(result.astEqual).toBe(true)
    expect(result.commentsEqual).toBe(true)
    expect(result.mapMismatches).toEqual([])
    expect(result.annotationsEqual).toBe(false)
    expect(result.comparisonPassed).toBe(false)
  })

  it('rejects moving NO_SIDE_EFFECTS between arrow initializers', () => {
    const input = 'const first = /* #__NO_SIDE_EFFECTS__ */ () => 1; const second = () => 2;'
    const printed = new MagicString(input).move(input.indexOf('/*'), input.indexOf('() => 1'), input.indexOf('() => 2'))
    const map = JSON.parse(printed.generateMap({ hires: true, includeContent: true, source: filename }).toString()) as unknown
    const result = inspectRoundTrip(input, printed.toString(), map, filename)
    expect(result.astEqual).toBe(true)
    expect(result.commentsEqual).toBe(true)
    expect(result.mapMismatches).toEqual([])
    expect(result.annotationsEqual).toBe(false)
    expect(result.comparisonPassed).toBe(false)
  })

  it('preserves annotation owners for calls, constructors, declarations and arrow functions', () => {
    const input = '/* @__PURE__ */ first();\n/* #__PURE__ */ new Factory();\n/* @__NO_SIDE_EFFECTS__ */ function declared() {}\nconst arrow = /* #__NO_SIDE_EFFECTS__ */ () => 1;'
    const result = inspectRoundTrip(input, input, unchanged(input), filename)
    expect(result.annotationsEqual).toBe(true)
    expect(result.annotationCount).toEqual({ original: 4, generated: 4 })
    expect(result.comparisonPassed).toBe(true)
  })

  it('does not normalize away a semantic or directive change', () => {
    const input = '"use strict"; const value = true;'
    expect(inspectRoundTrip(input, input.replace('true', 'false'), unchanged(input), filename).astEqual).toBe(false)
    expect(inspectRoundTrip(input, input.replace('use strict', 'use sloppy'), unchanged(input), filename).astEqual).toBe(false)
  })

  it('reports missing annotations and incorrect token origins', () => {
    const input = '/* @__PURE__ */ factory();'
    expect(inspectRoundTrip(input, 'factory();', unchanged(input), filename).commentsEqual).toBe(false)
    const result = inspectRoundTrip('const value = 1;', '\nconst value = 1;', unchanged('const value = 1;'), filename)
    expect(result.mapMismatches).not.toHaveLength(0)
    expect(result.comparisonPassed).toBe(false)
  })

  it('rejects source identity mismatches before interpreting a map', () => {
    expect(() => inspectRoundTrip('const value = 1;', 'const value = 1;', unchanged('const other = 1;'), filename)).toThrow('exact original')
  })
})
