/* eslint-disable no-template-curly-in-string -- 测试数据包含待解析的模板字面量。 */
import type { ElementNode } from './types'
import { describe, expect, it } from 'vitest'
import { parse } from './parser'
import { scan, scanComments } from './scanner'
import { readTag } from './tag'

describe('template text boundaries', () => {
  it('preserves long static text and literal less-than characters around real markup', () => {
    const prefix = `before < 1 and <2 ${'plain text '.repeat(24_000)}`
    const suffix = `${'tail '.repeat(12_000)}< <3`
    const source = `${prefix}<view>middle</view>${suffix}`
    const document = parse(source)
    expect(document.diagnostics).toEqual([])
    expect(document.children).toMatchObject([{ kind: 'text', data: prefix }, { kind: 'element', name: 'view' }, { kind: 'text', data: suffix }])
    expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
  })

  it('never exposes markup inside bindings or attributes as real tags', () => {
    const before = '{{ "<fake/>" + `x${{ html: "<nested/>" }.html}` }}'
    const source = `${before}<view title="{{ '<attribute/>' }}" other="literal <ignored/>">{{ /<view>/.test(value) ? '<inside/>' : '}}' }}</view>{{ '<after/>' }}<text/>`
    const document = parse(source, { syntax: 'xml' })
    expect(document.diagnostics).toEqual([])
    expect(document.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['view', 'view', 'text'])
    expect(document.children[0]).toMatchObject({ kind: 'text', data: before })
    expect(document.tokens).toEqual(scan(source, { syntax: 'xml' }).tokens)
    expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
  })

  it.each(['legacy', 'xml'] as const)('invalidates %s text candidates crossed by scripts, CDATA, comments and declarations', (syntax) => {
    const script = 'var source = "{{ not a binding <fake/>"; /* {{ <comment/> */ module.exports = {};'
    const source = `<?tool value="{{ <declaration/>"?><wxs>${script}</wxs><![CDATA[ {{ <cdata/> ]]><!-- {{ <comment/> --><view/>{{ '}} <binding/>' }}<text/>`
    const document = parse(source, { syntax })
    expect(document.diagnostics).toEqual([])
    expect(document.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['wxs', 'wxs', 'view', 'text'])
    expect((document.children.find(node => node.kind === 'element') as ElementNode).children[0]).toMatchObject({ kind: 'script', data: script })
    expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
  })

  it.each(['legacy', 'xml'] as const)('preserves %s positions across many tags without bindings and a final distant binding', (syntax) => {
    const tags = '<view data-value="plain"/>'.repeat(4096)
    for (const tail of ['', '{{ \'<last-fake/>\' }}<text/>']) {
      const source = `${tags}${tail}`
      const document = parse(source, { syntax })
      expect(document.diagnostics).toEqual([])
      expect(document.tokens.filter(token => token.kind === 'tag')).toHaveLength(tail ? 4097 : 4096)
      expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
      expect(document.children[4095]?.end).toBe(tags.length)
    }
  })

  it.each(['legacy', 'xml'] as const)('keeps %s comment-only scans bounded by the final candidate and skips opaque fake comments', (syntax) => {
    const source = '<view title="<!--attr-->">{{ "<!--binding-->" }}</view><wxs>var source="<!--script-->";</wxs><![CDATA[<!--cdata-->]]><!--actual--><bad value="unterminated'
    const result = scanComments(source, { syntax })
    expect(result.diagnostics).toEqual([])
    expect(result.tokens.map(token => source.slice(token.start, token.end))).toEqual(['<!--actual-->'])
  })

  it.each(['"', '\''])('preserves long XML attributes and embedded host quotes with %s delimiters', (quote) => {
    const value = `${'literal <ignored/> { &amp; '.repeat(8192)}{{ ${quote}same quote${quote} }}tail{{ 1 + 2 }}`
    const source = `<view title=${quote}${value}${quote} plain=${quote}static${quote}/>{{ '<fake/>' }}`
    const document = parse(source, { syntax: 'xml' })
    expect(document.diagnostics).toEqual([])
    expect(document.tokens).toEqual(scan(source, { syntax: 'xml' }).tokens)
    const element = document.children[0] as ElementNode
    expect(readTag(source, 0, 'xml')).toEqual(element.opening)
    expect(element.attributes.map(attribute => attribute.value)).toEqual([value, 'static'])
    expect(element.attributes[0]).toMatchObject({ valueStart: 13, valueEnd: 13 + value.length, quote })
    expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
  })

  it('reports an unterminated binding before a missing XML attribute delimiter and recovers search state', () => {
    const source = '<view title="prefix{{ (value }}'
    expect(scan(source, { syntax: 'xml' }).diagnostics).toMatchObject([
      { code: 'template/invalid-interpolation', start: source.indexOf('}}'), recovery: { start: source.indexOf('{{'), end: source.length } },
    ])
    expect(parse('<view title="valid"/>', { syntax: 'xml' }).diagnostics).toEqual([])
  })

  it.each(['"', '\''])('reports a missing XML %s delimiter after static text or complete bindings', (quote) => {
    for (const value of ['literal { tail', '{{ { value: 1 } }}tail', '{{ value }}'.repeat(8192)]) {
      const result = scan(`<view title=${quote}${value}`, { syntax: 'xml' })
      expect(result.diagnostics).toMatchObject([{ code: 'template/invalid-syntax', start: 6 }])
      expect(result.diagnostics[0]?.recovery).toBeUndefined()
      expect(parse(`<view title=${quote}valid${quote}/>`, { syntax: 'xml' }).diagnostics).toEqual([])
    }
  })
})
