import { describe, expect, it } from 'vitest'
import { decodeAttribute } from './decode'

describe('lexical attribute decoding', () => {
  it.each([
    ['&amp;&lt;&gt;&quot;&apos;', '&<>"\''],
    ['&#65; &#x41; &#x1F680;', 'A A 🚀'],
    ['&nbsp; &copy; &unknown;', '&nbsp; &copy; &unknown;'],
    ['&amp &#65 &#x41 &;', '&amp &#65 &#x41 &;'],
    ['&#0; &#xD800; &#x110000;', '\uFFFD \uFFFD \uFFFD'],
    ['&amp;lt;', '&lt;'],
  ])('preserves XML entity decoding semantics for %s', (source, expected) => {
    for (const syntax of ['legacy', 'xml'] as const) {
      expect(decodeAttribute(source, syntax)).toBe(expected)
      expect(decodeAttribute(source, syntax, false)).toBe(source)
    }
  })

  it('keeps entity decoding outside legacy bindings and across the complete XML value', () => {
    const source = 'pre&amp;{{"&amp;"}}post&#x1F680;'
    expect(decodeAttribute(source, 'legacy')).toBe('pre&{{"&amp;"}}post🚀')
    expect(decodeAttribute(source, 'xml')).toBe('pre&{{"&"}}post🚀')
  })

  it.each([
    String.raw`path\file`,
    String.raw`path\\file`,
    String.raw`pre\path{{name}}post\end`,
    String.raw`{{'a\\b'}}`,
    String.raw`{{'a\'b'}}`,
  ])('preserves unquoted legacy backslashes in %s', (value) => {
    expect(decodeAttribute(value, 'legacy', false)).toBe(value)
  })

  it('decodes entities independently from the unquoted escape layer', () => {
    expect(decodeAttribute(String.raw`path\file&amp;`, 'legacy')).toBe(String.raw`path\file&`)
    expect(decodeAttribute(String.raw`path\file&amp;`, 'legacy', false)).toBe(String.raw`path\file&amp;`)
  })

  it('decodes a quoted legacy layer while preserving expression string escapes', () => {
    expect(decodeAttribute(String.raw`path\\file\"`, 'legacy', false, '"')).toBe(String.raw`path\file"`)
    expect(decodeAttribute(String.raw`{{\"a\\\\b\"}}`, 'legacy', false, '"')).toBe(String.raw`{{"a\\b"}}`)
    expect(decodeAttribute(String.raw`{{'a\\'b'}}`, 'legacy', false, '"')).toBe(String.raw`{{'a\'b'}}`)
  })

  it.each([
    String.raw`{{"a\"b"}}`,
    String.raw`{{"tail\\"}}`,
    String.raw`{{"a\\\"b"}}`,
    String.raw`{{'a\'b'}}`,
    String.raw`{{ /\"/.test(value) }}`,
    String.raw`{{ value /* \" */ }}`,
    String.raw`{{ 1 < 2 && 3 > 2 ? "&amp;" : "<>&" }}`,
  ])('decodes the complete host layer while preserving logical binding bytes: %s', (expression) => {
    for (const quote of ['"', '\'']) {
      const encoded = expression.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`)
      expect(decodeAttribute(encoded, 'legacy', true, quote)).toBe(expression)
      expect(decodeAttribute(`pre\\path&amp;${encoded}post\\end&amp;`, 'legacy', true, quote))
        .toBe(`prepath&${expression}postend&`)
    }
    expect(decodeAttribute(expression, 'legacy', true)).toBe(expression)
  })

  it('decodes the host layer without requiring a valid JavaScript recovery expression', () => {
    const value = String.raw`{{\"a\\\"b\" + invalid( }}`
    expect(decodeAttribute(value, 'legacy', false, '"')).toBe(String.raw`{{"a\"b" + invalid( }}`)
    expect(decodeAttribute(String.raw`\q\\\"`, 'legacy', false, '"')).toBe(String.raw`q\"`)
  })
})
