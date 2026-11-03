import { describe, expect, it } from 'vitest'
import { parseWxml } from '../src/compiler/wxml/parser'
import { createTemplate } from '../src/runtime/legacyTemplate'
import { parseSharedTemplateNodes } from '../src/runtime/legacyTemplate/parser'
import { parseSharedTemplateDocument } from '../src/shared/templateParser'

const cases = [
  { name: 'single quote escape', expression: String.raw`'a\'b'`, xml: String.raw`'a\'b'`, html: 'a&#39;b' },
  { name: 'double quote escape', expression: String.raw`"a\"b"`, xml: String.raw`&quot;a\&quot;b&quot;`, html: 'a&quot;b' },
  { name: 'single quote tail', expression: String.raw`'tail\\'`, xml: String.raw`'tail\\'`, html: 'tail\\' },
  { name: 'double quote tail', expression: String.raw`"tail\\"`, xml: String.raw`&quot;tail\\&quot;`, html: 'tail\\' },
  { name: 'mixed single quote escape', expression: String.raw`'a\\\'b'`, xml: String.raw`'a\\\'b'`, html: 'a\\&#39;b' },
  { name: 'mixed double quote escape', expression: String.raw`"a\\\"b"`, xml: String.raw`&quot;a\\\&quot;b&quot;`, html: 'a\\&quot;b' },
  { name: 'operators and markup', expression: 'left < right && right > 0 ? "<&>" : "other"', xml: 'left &lt; right &amp;&amp; right &gt; 0 ? &quot;&lt;&amp;&gt;&quot; : &quot;other&quot;', html: '&lt;&amp;&gt;' },
  { name: 'entity-shaped string', expression: '"&amp; &quot; &#34;"', xml: '&quot;&amp;amp; &amp;quot; &amp;#34;&quot;', html: '&amp;amp; &amp;quot; &amp;#34;' },
]

/** 官方宿主属性层：先翻倍 JS 反斜杠，再编码当前外层引号。 */
function legacyAttributeSource(value: string, quote = '"') {
  return value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)
}

describe('Web attribute encoding boundaries', () => {
  describe.each([
    { syntax: 'legacy', quote: '"' },
    { syntax: 'legacy', quote: '\'' },
    { syntax: 'xml', quote: '"' },
  ] as const)('$syntax input with $quote attributes', ({ syntax, quote }) => {
    it.each(cases)('consumes $name from its own source layer without rewriting JavaScript', ({ expression, xml, html }) => {
      const binding = syntax === 'legacy' ? legacyAttributeSource(`{{${expression}}}`, quote) : `{{${xml}}}`
      const source = `<view title=${quote}${binding}${quote} />`
      const expected = `{{${expression}}}`
      for (const nodes of [parseWxml(source, { syntax }), parseSharedTemplateNodes(source, { syntax })]) {
        expect(nodes[0]).toMatchObject({ name: 'view', attribs: { title: expected } })
      }
      expect(createTemplate(source, { syntax })({ left: 1, right: 2 }))
        .toBe(`<weapp-view title="${html}"></weapp-view>`)
    })
  })

  it.each(['legacy', 'xml'] as const)('preserves unquoted literal backslashes while applying the %s binding entity profile', (syntax) => {
    const binding = syntax === 'legacy' ? '{{"&amp;"}}' : '{{&quot;&amp;amp;&quot;}}'
    const source = String.raw`<view title=path\file data-value=${binding} />`
    for (const nodes of [parseWxml(source, { syntax }), parseSharedTemplateNodes(source, { syntax })]) {
      expect(nodes[0]).toMatchObject({ attribs: { 'title': String.raw`path\file`, 'data-value': '{{"&amp;"}}' } })
    }
  })

  it('decodes the quoted legacy static layer independently of JavaScript bindings', () => {
    const binding = legacyAttributeSource(String.raw`{{"a\"b"}}`)
    const source = String.raw`<view title="path\\file \"double\" \'single\' &amp;amp; ${binding}" />`
    const expected = String.raw`path\file "double" 'single' &amp; {{"a\"b"}}`
    for (const nodes of [parseWxml(source, { syntax: 'legacy' }), parseSharedTemplateNodes(source)]) {
      expect(nodes[0]).toMatchObject({ attribs: { title: expected } })
    }
    expect(createTemplate(source)())
      .toBe(String.raw`<weapp-view title="path\file &quot;double&quot; &#39;single&#39; &amp;amp; a&quot;b"></weapp-view>`)
  })

  describe.each(['"', '\''])('recovered legacy bindings with %s attributes', (quote) => {
    it.each(cases)('preserves $name inside and beside a recovered binding', ({ expression }) => {
      const valid = `{{${expression}}}`
      const recovered = `{{${expression} + invalid( }}`
      const encodedValid = legacyAttributeSource(valid, quote)
      const encodedRecovery = legacyAttributeSource(recovered, quote)
      const source = String.raw`<view title=${quote}before\x ${encodedValid} &amp;amp; ${encodedRecovery} ${encodedValid} after\y${quote} />`
      const expected = `beforex ${valid} &amp; ${recovered} ${valid} aftery`
      const parsed = parseSharedTemplateDocument(source, { syntax: 'legacy' })
      expect(parsed.recoveries).toHaveLength(1)
      expect(source.slice(parsed.recoveries[0]!.start, parsed.recoveries[0]!.end)).toBe(encodedRecovery)
      for (const nodes of [parseWxml(source, { syntax: 'legacy' }), parseSharedTemplateNodes(source)]) {
        expect(nodes[0]).toMatchObject({ attribs: { title: expected } })
      }
    })
  })

  it.each(['legacy', 'xml'] as const)('recovers %s entity-shaped strings without requiring a backslash', (syntax) => {
    const binding = syntax === 'legacy' ? '{{\'&amp;\' + invalid( }}' : '{{&apos;&amp;amp;&apos; + invalid( }}'
    const source = `<view title="&amp;amp; ${binding} &amp;amp;" />`
    for (const nodes of [parseWxml(source, { syntax }), parseSharedTemplateNodes(source, { syntax })]) {
      expect(nodes[0]).toMatchObject({ attribs: { title: '&amp; {{\'&amp;\' + invalid( }} &amp;' } })
    }
  })
})
