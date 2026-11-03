import { describe, expect, it } from 'vitest'
import { decodeAttribute } from './decode'
import { parse } from './parser'
import { serialize } from './serialize'

describe('WXML serialization', () => {
  it('preserves every source byte across XML constructs and attribute forms', () => {
    const source = '\uFEFF<?xml version="1.0"?>\r\n<!--opaque--><view  a=unquoted bare empty="" dup="first" dup=second><![CDATA[<text/>]]><text>😀 &amp; {{value}}</text></view>\r\n'
    const document = parse(source, { syntax: 'xml' })
    expect(document.diagnostics).toEqual([])
    expect(serialize(document)).toBe(source)
    expect(serialize(document, { mode: 'preserve' })).toBe(source)
  })

  it('really visits the AST in canonical mode while retaining raw content and duplicate order', () => {
    const source = '<?xml version="1.0"?><view  a=unquoted bare empty=\'\' dup="first" dup=second><!-- unchanged --><![CDATA[<text/>]]><text>  &amp; {{value}} </text><wxs module="m">module.exports = { x: "<view/>" }</wxs></view>'
    const document = parse(source, { syntax: 'xml' })
    const canonical = serialize(document, { mode: 'canonical' })
    expect(canonical).toBe('<?xml version="1.0"?><view a="unquoted" bare empty="" dup="first" dup="second"><!-- unchanged --><![CDATA[<text/>]]><text>  &amp; {{value}} </text><wxs module="m">module.exports = { x: "<view/>" }</wxs></view>')
    expect(canonical).not.toBe(source)
    expect(serialize(parse(canonical, { syntax: 'xml' }), { mode: 'canonical' })).toBe(canonical)
  })

  it('normalizes XML quotes without encoding existing entities twice', () => {
    const document = parse('<view title=\'a"b &amp; &quot; &#34;\' value=\'{{"x"}}\' />', { syntax: 'xml' })
    const canonical = serialize(document, { mode: 'canonical' })
    expect(canonical).toBe('<view title="a&quot;b &amp; &quot; &#34;" value="{{&quot;x&quot;}}" />')
    const reparsed = parse(canonical, { syntax: 'xml' })
    expect(reparsed.diagnostics).toEqual([])
    expect(serialize(reparsed, { mode: 'canonical' })).toBe(canonical)
    const nestedQuotes = parse('<view value="{{"x"}}"/>', { syntax: 'xml' })
    expect(serialize(nestedQuotes, { mode: 'canonical' })).toBe('<view value="{{&quot;x&quot;}}" />')
  })

  it.each([
    String.raw`<view title='a\'b" c\\d' />`,
    String.raw`<view value='{{"a\\b"}}' />`,
    String.raw`<view value={{"a\\b"}} />`,
    String.raw`<view value="{{\"a\\b\"}}" />`,
  ])('preserves legacy attribute semantics when normalizing %s', (source) => {
    const before = parse(source)
    expect(before.diagnostics).toEqual([])
    const canonical = serialize(before, { mode: 'canonical' })
    const after = parse(canonical)
    expect(after.diagnostics).toEqual([])
    const attribute = before.children[0]?.kind === 'element' ? before.children[0].attributes[0]! : undefined
    const normalized = after.children[0]?.kind === 'element' ? after.children[0].attributes[0]! : undefined
    expect(normalized?.quote).toBe('"')
    expect(decodeAttribute(normalized!.value!, 'legacy', false, normalized!.quote))
      .toBe(decodeAttribute(attribute!.value!, 'legacy', false, attribute!.quote))
    expect(serialize(after, { mode: 'canonical' })).toBe(canonical)
  })

  it.each([
    { value: String.raw`path\file`, canonical: String.raw`path\\file`, decoded: String.raw`path\file` },
    { value: String.raw`path\\file`, canonical: String.raw`path\\\\file`, decoded: String.raw`path\\file` },
    { value: String.raw`pre\path{{name}}post\end`, canonical: String.raw`pre\\path{{name}}post\\end`, decoded: String.raw`pre\path{{name}}post\end` },
    { value: String.raw`{{'a\\b'}}`, canonical: String.raw`{{'a\\\\b'}}`, decoded: String.raw`{{'a\\b'}}` },
    { value: String.raw`{{'a\'b'}}`, canonical: String.raw`{{'a\\'b'}}`, decoded: String.raw`{{'a\'b'}}` },
    { value: String.raw`{{"a\\b"}}`, canonical: String.raw`{{\"a\\\\b\"}}`, decoded: String.raw`{{"a\\b"}}` },
  ])('quotes unquoted legacy $value with an independent lexical oracle', ({ value, canonical, decoded }) => {
    const document = parse(`<view value=${value}/>`)
    expect(document.diagnostics).toEqual([])
    const expected = `<view value="${canonical}" />`
    expect(serialize(document, { mode: 'canonical' })).toBe(expected)
    const reparsed = parse(expected)
    expect(reparsed.diagnostics).toEqual([])
    const root = reparsed.children[0]
    expect(root?.kind).toBe('element')
    if (root?.kind === 'element') {
      const attribute = root.attributes[0]!
      expect(decodeAttribute(attribute.value!, 'legacy', false, attribute.quote)).toBe(decoded)
    }
    expect(serialize(reparsed, { mode: 'canonical' })).toBe(expected)
  })

  it('normalizes only the outer layer when JavaScript contains escaped quotes', () => {
    const source = String.raw`<view value='{{"a\\"b"}}' />`
    const canonical = String.raw`<view value="{{\"a\\\"b\"}}" />`
    expect(serialize(parse(source))).toBe(source)
    expect(serialize(parse(source), { mode: 'canonical' })).toBe(canonical)
    expect(serialize(parse(canonical), { mode: 'canonical' })).toBe(canonical)
  })

  it('rejects invalid documents and unknown serialization modes', () => {
    expect(() => serialize(parse('<view>'))).toThrow('invalid')
    expect(() => serialize(parse('<view/>'), { mode: 'other' } as never)).toThrow('mode')
  })

  it('serializes deep trees without recursive traversal', () => {
    const source = `${'<view>'.repeat(4000)}text${'</view>'.repeat(4000)}`
    expect(serialize(parse(source), { mode: 'canonical' })).toBe(source)
  })
})
