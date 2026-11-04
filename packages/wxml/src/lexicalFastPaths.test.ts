import { expect, it } from 'vitest'
import { decodeAttribute } from './decode'
import { expressionEnd } from './expression'
import { parse } from './parser'
import { scan } from './scanner'
import { serialize } from './serialize'

it.each(['legacy', 'xml'] as const)('preserves simple member paths and complex fallback boundaries in %s', (syntax) => {
  for (const expression of ['{{ item }}', '{{ $item._value }}', '{{\u00A0item.value\u2028}}', '{{ item["value"] }}', '{{ item && next }}', '{{ item /* }} */ }}', `{{ \`value\${item}\` }}`]) {
    const source = `<view value="${expression.replaceAll('"', '&quot;')}"/>`
    expect(expressionEnd(`${expression}tail`, 0, true, syntax)).toBe(expression.length)
    const document = parse(source, { syntax })
    expect(document.diagnostics).toEqual([])
    expect(scan(source, { syntax }).tokens).toEqual(document.tokens)
    expect(serialize(document)).toBe(source)
  }
})

it('uses the flat interpolation boundary only when nested lexical delimiters are absent', () => {
  expect(expressionEnd('{{ item && next }}tail', 0, true, 'xml')).toBe('{{ item && next }}'.length)
  expect(expressionEnd('{{ item + value }}tail', 0, true, 'legacy')).toBe('{{ item + value }}'.length)
  expect(expressionEnd('{{ item[0] }}tail', 0, true, 'xml')).toBe('{{ item[0] }}'.length)
  expect(expressionEnd('{{ item /* }} */ }}tail', 0, true, 'xml')).toBe('{{ item /* }} */ }}'.length)
})

it('preserves encoded quote length limits, case and zero-padded numeric delimiters', () => {
  for (const entity of ['&QUOT;', '&ApOs;', '&#X00022;', '&#00039;', `&#${'0'.repeat(11)}34;`]) {
    const expression = `{{ ${entity}}}${entity} }}`
    expect(expressionEnd(expression, 0, true, 'xml')).toBe(expression.length)
  }
  const long = `&#${'0'.repeat(12)}34;`
  const expression = `{{ ${long}}}${long} }}`
  expect(expressionEnd(expression, 0, true, 'xml')).toBe(expression.indexOf('}}') + 2)
  const logical = '{{ a && b }}'
  expect(expressionEnd(`${logical}${'x'.repeat(8192)};`, 0, true, 'xml')).toBe(logical.length)
})

it('keeps XML entity decoding independent from plain values and disabled decoding', () => {
  for (const value of ['', 'plain', '😀\r\n{{ item }}', String.raw`path\file`]) {
    expect(decodeAttribute(value, 'xml')).toBe(value)
  }
  expect(decodeAttribute('a&amp;b', 'xml')).toBe('a&b')
  expect(decodeAttribute('a&amp;b', 'xml', false)).toBe('a&amp;b')
})
