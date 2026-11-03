import { describe, expect, it } from 'vitest'
import { decodeAttribute } from './decode'
import { edit } from './edit'
import { encodeAttribute } from './encoding'
import { expressionEnd, interpolations } from './expression'
import { parse } from './parser'
import { serialize } from './serialize'

const oppositeQuoteCases = [
  { quote: '"', expression: String.raw`{{ 'a\'}}b' }}` },
  { quote: '"', expression: String.raw`{{ 'tail\\' + value }}` },
  { quote: '"', expression: String.raw`{{ 'a\\\'}}b' }}` },
  { quote: '"', expression: String.raw`{{ 'tail\\\\' + value }}` },
  { quote: '\'', expression: String.raw`{{ "a\"}}b" }}` },
  { quote: '\'', expression: String.raw`{{ "tail\\" + value }}` },
  { quote: '\'', expression: String.raw`{{ "a\\\"}}b" }}` },
  { quote: '\'', expression: String.raw`{{ "tail\\\\" + value }}` },
]

describe('expression string encoding layers', () => {
  it.each(['legacy', 'xml'] as const)('keeps opposite attribute quotes on the JavaScript escape layer in %s', (syntax) => {
    for (const item of oppositeQuoteCases) {
      const { quote } = item
      const expression = syntax === 'legacy' ? item.expression.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`) : item.expression
      expect(expressionEnd(expression, 0, true, syntax, quote), expression).toBe(expression.length)
      expect(interpolations(`before${expression}after`, syntax, quote), expression)
        .toEqual([{ start: 6, end: expression.length + 6 }])
      const source = `<view value=${quote}${expression}${quote}/><tail/>`
      const document = parse(source, { syntax })
      expect(document.diagnostics, source).toEqual([])
      expect(document.children.map(node => node.kind === 'element' ? node.name : node.kind)).toEqual(['view', 'tail'])
    }
  })

  it.each([
    { quote: '"', expression: String.raw`{{ \"a\\\"}}b\" }}` },
    { quote: '"', expression: String.raw`{{ \"tail\\\\\" + value }}` },
    { quote: '"', expression: String.raw`{{ \"a\\\\\\\"}}b\" }}` },
    { quote: '"', expression: String.raw`{{ \"tail\\\\\\\\\" + value }}` },
    { quote: '\'', expression: String.raw`{{ \'a\\\'}}b\' }}` },
    { quote: '\'', expression: String.raw`{{ \'tail\\\\\' + value }}` },
  ])('removes one complete legacy host layer before matching $quote delimiters: $expression', ({ quote, expression }) => {
    expect(expressionEnd(expression, 0, true, 'legacy', quote)).toBe(expression.length)
    expect(parse(`<view value=${quote}${expression}${quote}/>`, { syntax: 'legacy' }).diagnostics).toEqual([])
  })

  it.each(['legacy', 'xml'] as const)('retains entity delimiters in XML and the existing unquoted/text %s contract', (syntax) => {
    for (const expression of [
      '{{ fn(&quot;}}&quot;) }}',
      '{{ fn(&#x22;}}&#34;) }}',
      '{{ fn(&apos;}}&apos;) }}',
      '{{ &apos;}}\' }}',
      String.raw`{{ &quot;a\&quot;}}b&quot; }}`,
      String.raw`{{ &quot;tail\\&quot; + value }}`,
      '{{ &quot;a&amp;quot;}}b&quot; }}',
    ]) {
      expect(expressionEnd(expression, 0, true, syntax), expression).toBe(expression.length)
      if (syntax === 'xml') {
        expect(expressionEnd(expression, 0, true, syntax, '"'), expression).toBe(expression.length)
        expect(parse(`<view value="${expression}"/>`, { syntax }).diagnostics, expression).toEqual([])
      }
      for (const source of [
        `<view value=${expression}/>`,
        `<view>${expression}</view>`,
      ]) {
        expect(parse(source, { syntax }).diagnostics, source).toEqual([])
      }
    }
  })

  it('does not let an entity closer terminate a raw legacy JavaScript string', () => {
    const expression = '{{ \'}}&apos; }}'
    expect(() => expressionEnd(expression, 0, true, 'legacy')).toThrow()
    expect(expressionEnd(expression, 0, true, 'xml')).toBe(expression.length)
    for (const source of [`<view value="${expression}"/>`, `<view value=${expression}/>`, `<view>${expression}</view>`]) {
      expect(parse(source, { syntax: 'legacy' }).diagnostics).not.toEqual([])
      expect(parse(source, { syntax: 'xml' }).diagnostics).toEqual([])
    }
  })

  it('preserves entity-like text inside raw JavaScript strings after decoding the host layer', () => {
    const expression = String.raw`{{ \"&quot;&#34;&amp;}}\" }}`
    expect(expressionEnd(expression, 0, true, 'legacy', '"')).toBe(expression.length)
    expect(decodeAttribute(expression, 'legacy', true, '"')).toBe(String.raw`{{ "&quot;&#34;&amp;}}" }}`)
    expect(parse(`<view title="${expression}"/>`).diagnostics).toEqual([])
  })

  it.each([
    { syntax: 'legacy', encoded: String.raw`{{'a\\'}}b' + \"tail\\\\\"}}` },
    { syntax: 'xml', encoded: String.raw`{{'a\'}}b' + &quot;tail\\&quot;}}` },
  ] as const)('accepts actual %s encoder output against an independent source expectation', ({ syntax, encoded }) => {
    const expression = String.raw`'a\'}}b' + "tail\\"`
    expect(encodeAttribute({ expression }, syntax)).toBe(encoded)
    expect(expressionEnd(encoded, 0, true, syntax, '"')).toBe(encoded.length)
    expect(decodeAttribute(encoded, syntax, true, '"')).toBe(`{{${expression}}}`)
    expect(parse(`<view value="${encoded}"/>`, { syntax }).diagnostics).toEqual([])
  })

  it.each([
    { syntax: 'legacy', quote: '"', expression: String.raw`{{ 'tail\\' }}` },
    { syntax: 'xml', quote: '"', expression: String.raw`{{ 'tail\' }}` },
    { syntax: 'legacy', quote: '"', expression: String.raw`{{ \"tail\\\" }}` },
    { syntax: 'xml', quote: '"', expression: String.raw`{{ &quot;tail\&quot; }}` },
  ] as const)('rejects an escaped closing quote without a later delimiter: $expression', ({ syntax, quote, expression }) => {
    expect(() => expressionEnd(expression, 0, true, syntax, quote)).toThrow('表达式字符串')
    expect(parse(`<view value=${quote}${expression}${quote}/>`, { syntax }).diagnostics).not.toEqual([])
  })

  it.each([
    { source: String.raw`<view value="{{"a\"b"}}"/>`, offset: 0 },
    { source: String.raw`<view value="{{\"a\\"b\"}}"/>`, offset: 2 },
    { source: String.raw`<view value="{{'a"b'}}"/>`, offset: 2 },
    { source: String.raw`<view value='{{'a'}}'/>`, offset: 0 },
  ])('keeps invalid raw outer quotes readable but refuses edit and serialization: $source', ({ source, offset }) => {
    const document = parse(source)
    expect(document.source).toBe(source)
    expect(document.diagnostics[0]).toMatchObject({ code: 'template/invalid-syntax', start: source.indexOf('{{') + offset })
    expect(() => edit(document, () => {})).toThrow(TypeError)
    expect(() => serialize(document)).toThrow(TypeError)
    expect(() => serialize(document, { mode: 'canonical' })).toThrow(TypeError)
  })

  it('maps multiple bindings and escaped delimiters to their original UTF-16 ranges', () => {
    const value = String.raw`😀pre\{\{\"a\\\"}}b\"}}mid{{'c\\'d'}}tail`
    const ranges = interpolations(value, 'legacy', '"')
    expect(ranges).toEqual([
      { start: value.indexOf('\\{'), end: value.indexOf('mid') },
      { start: value.indexOf('{{'), end: value.indexOf('tail') },
    ])
    const source = `<view value="${value}"/>`
    const document = parse(source)
    expect(document.diagnostics).toEqual([])
    const node = document.children[0]
    expect(node?.kind === 'element' && node.attributes[0]?.value).toBe(value)
  })

  it('applies the same host decoding to words, comments and expression strings', () => {
    const value = String.raw`{{ (() => { ret\urn /}}/.test(value) })() + \/\* }} <fake/> *\/ 1 }}`
    expect(expressionEnd(value, 0, true, 'legacy', '"')).toBe(value.length)
    const source = `<view value="${value}"/><tail/>`
    const document = parse(source)
    expect(document.diagnostics).toEqual([])
    expect(document.children.map(node => node.kind === 'element' ? node.name : node.kind)).toEqual(['view', 'tail'])
  })
})
