/* eslint-disable no-template-curly-in-string -- 测试数据刻意包含待解析模板字符串。 */
import type { ElementNode } from './types'
import { describe, expect, it } from 'vitest'
import { decodeAttribute } from './decode'
import { expressionEnd, interpolations } from './expression'
import { parse } from './parser'
import { scan, scanComments } from './scanner'
import { findScriptClosingTag, findTrailingScriptComment, scanScriptBoundaryCandidates } from './script'
import { walk } from './walk'

describe('source preserving parser', () => {
  it('preserves every token range, attribute form and duplicate in UTF-16 source', () => {
    const source = '😀\r\n<?xml version="1.0"?><!--keep--><![CDATA[ <view/> ]]><Widget disabled empty="" a=first a=second value=\'&amp;\'><text> a {{ value }} b </text></Widget>'
    const document = parse(source)
    expect(document.diagnostics).toEqual([])
    expect(document.tokens.map(token => source.slice(token.start, token.end)).join('')).toBe(source)
    const root = document.children.find(node => node.kind === 'element') as ElementNode
    expect(root.name).toBe('Widget')
    expect(root.attributes.map(attribute => [attribute.name, attribute.value, attribute.rawValue, attribute.quote])).toEqual([
      ['disabled', undefined, undefined, undefined],
      ['empty', '', '""', '"'],
      ['a', 'first', 'first', undefined],
      ['a', 'second', 'second', undefined],
      ['value', '&amp;', '\'&amp;\'', '\''],
    ])
    for (const attribute of root.attributes) {
      expect(source.slice(attribute.nameStart, attribute.nameEnd)).toBe(attribute.name)
      if (attribute.valueStart !== undefined) {
        expect(source.slice(attribute.valueStart, attribute.valueEnd)).toBe(attribute.value)
      }
    }
    expect(root.start).toBe(source.indexOf('<Widget'))
    expect(root.end).toBe(source.length)
    const opening = root.opening
    expect(document.tokens[opening.matching!]).toBe(root.closing)
    expect(root.closing?.matching).toBe(document.tokens.indexOf(opening))
    const child = root.children[0] as ElementNode
    expect(child.opening.parent).toBe(document.tokens.indexOf(opening))
  })

  it.each(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'qq', 'ks', 'ty'] as const)('keeps %s syntax intact without a cross-platform rewrite', (platform) => {
    const source = '<view s-for="row,pos in rows" s-if="row.visible" onTap="select" wx:key="id"/>'
    const document = parse(source, { platform })
    expect(document.platform).toBe(platform)
    expect(document.syntax).toBe(platform === 'weapp' ? 'legacy' : 'xml')
    expect(document.diagnostics).toEqual([])
    expect((document.children[0] as ElementNode).attributes.map(attribute => attribute.value)).toEqual(['row,pos in rows', 'row.visible', 'select', 'id'])
  })

  it('uses explicit syntax before the platform default', () => {
    expect(parse('<view/>', { platform: 'weapp', syntax: 'xml' }).syntax).toBe('xml')
    expect(parse('<view/>', { platform: 'alipay', syntax: 'legacy' }).syntax).toBe('legacy')
  })

  it('snapshots caller options and raw tags for later materialization', () => {
    const rawTags = ['code']
    const options = { platform: 'alipay' as const, rawTags }
    const document = parse('<code>"<fake/>"</code>', options)
    rawTags[0] = 'other'
    Object.assign(options, { platform: 'weapp', syntax: 'legacy' })
    expect(document.platform).toBe('alipay')
    expect(document.syntax).toBe('xml')
    expect(document.options.platform).toBe('alipay')
    expect(document.options.syntax).toBe('xml')
    expect(document.options.rawTags).toEqual(['code'])
    expect(document.options).not.toBe(options)
    expect(document.options.rawTags).not.toBe(rawTags)
    expect(Object.isFrozen(document.options)).toBe(true)
    expect(Object.isFrozen(document.options.rawTags)).toBe(true)
    expect((parse(document.source, document.options).children[0] as ElementNode).children[0]?.kind).toBe('script')
    const defaults = parse('<view/>').options
    expect(defaults.platform).toBe('weapp')
    expect(defaults.syntax).toBe('legacy')
  })

  it('rejects unsupported JavaScript options instead of silently selecting a dialect', () => {
    expect(() => parse('<view/>', { platform: 'web' as never })).toThrow(TypeError)
    expect(() => parse('<view/>', { syntax: 'html' as never })).toThrow(TypeError)
    expect(() => parse('<view/>', { rawTags: [1 as never] })).toThrow(TypeError)
    expect(() => parse('<view/>', { resolveScriptBoundary: true as never })).toThrow(TypeError)
    expect(() => parse(1 as never)).toThrow(TypeError)
  })

  it('treats nested form, input and image as XML elements without HTML implicit closing', () => {
    const document = parse('<form><form><input><image/></input></form></form>')
    expect(document.diagnostics).toEqual([])
    const outer = document.children[0] as ElementNode
    const inner = outer.children[0] as ElementNode
    expect(inner.name).toBe('form')
    expect((inner.children[0] as ElementNode).name).toBe('input')
  })

  it.each([
    '<view>',
    '</view>',
    '<view><text></view></text>',
    '<view a="bad>',
    '<view a=>',
    '<view a="a"="b"/>',
    '<view>{{ (a] }}</view>',
    '<!-- bad',
    '<![CDATA[ bad',
    '<view data="{{ /bad }}"/>',
    '<wxs>var value = "bad</wxs>',
  ])('reports malformed syntax at an original source range: %s', (source) => {
    const document = parse(source)
    expect(document.diagnostics.length).toBeGreaterThan(0)
    for (const diagnostic of document.diagnostics) {
      expect(diagnostic.start).toBeGreaterThanOrEqual(0)
      expect(diagnostic.end).toBeLessThanOrEqual(source.length)
    }
  })

  it('builds a tree and scanning tokens with identical positions', () => {
    const source = '<view><text>a</text><custom /></view>'
    expect(parse(source).tokens).toEqual(scan(source).tokens)
    expect(scan(source)).not.toHaveProperty('children')
  })

  it('points an unterminated attribute to its owning name', () => {
    const source = '<view\r\n  title="unterminated>'
    expect(parse(source).diagnostics[0]?.start).toBe(source.indexOf('title'))
  })

  it('scans comments without building tag metadata or inspecting the inactive suffix', () => {
    const source = '<view disabled><!--keep--><bad a="unterminated'
    const result = scanComments(source)
    expect(result.diagnostics).toEqual([])
    expect(result.tokens).toEqual([{ kind: 'comment', start: 15, end: 26 }])
    const opaque = '<view title="<!--attribute-->">{{ "<!--expression-->" }}</view><wxs>var value="<!--script-->";</wxs><![CDATA[<!--cdata-->]]><!--actual-->'
    expect(scanComments(opaque).tokens.map(token => opaque.slice(token.start, token.end))).toEqual(['<!--actual-->'])
    expect(scanComments('<view><!--unclosed').diagnostics).not.toEqual([])
    expect(scanComments('<view>').diagnostics).toEqual([])
  })
})

describe('expression boundaries', () => {
  it.each([
    '{{ { x: [1, 2], nested: { ok: true } } }}',
    '{{ /[}]{2}/g.test(value) ? `x${{ x: "}}" }.x}` : a / b }}',
    '{{ counter++ / 2 > 1 ? /}}/.test(value) : 0 }}',
    '{{ foo + /* }} */ bar }}',
    '{{ a + // }}\n b }}',
    '{{ "<view/>" + value }}',
  ])('does not expose syntax inside %s as template structure', (expression) => {
    const source = `<view value="${expression}">${expression}</view>`
    const document = parse(source, { syntax: 'xml' })
    expect(document.diagnostics).toEqual([])
    expect(document.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['view', 'view'])
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    expect(interpolations(`before${expression}after`)).toEqual([{ start: 6, end: 6 + expression.length }])
  })

  it('handles legacy attributes and XML encoded expression strings', () => {
    const legacy = String.raw`<view data-test="\"test\"" title="{{ value === \"a\\\"b\" ? \"<debug/><!-- literal -->\" : \"other\" }}"/>`
    expect(parse(legacy).diagnostics).toEqual([])
    const xml = '<view title="{{ value === &quot;}}&quot; ? &quot;&lt;view/&gt;&quot; : &quot;other&quot; }}"/>'
    expect(parse(xml, { syntax: 'xml' }).diagnostics).toEqual([])
    const opposite = String.raw`<view probe="{{ 'a\\'b' }}" tail="{{ 'tail\\\\' }}"/>`
    expect(parse(opposite).diagnostics).toEqual([])
    expect(expressionEnd('{{ &#34oops; }}', 0, true, 'xml', '"')).toBe(15)
  })

  it('recognizes JavaScript Unicode whitespace before expression regexes', () => {
    const expression = '{{\u3000/}}/.test(value) }}'
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    expect(parse(`<view value="${expression}"/>`).diagnostics).toEqual([])
  })
})

describe('raw script boundaries', () => {
  it.each(['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'])('keeps %s bodies opaque', (tag) => {
    const body = `var a="</${tag}><view/>"; var b=/<view>/; /* </${tag}> */ module.exports = {a:a};`
    const source = `<${tag}>${body}</${tag}><view/>`
    const document = parse(source)
    expect(document.diagnostics).toEqual([])
    const script = (document.children[0] as ElementNode).children[0]
    expect(script).toMatchObject({ kind: 'script', data: body })
    expect(document.children).toHaveLength(2)
  })

  it.each([
    'var marker = /<\\/wxs>/;',
    'var marker = `literal </wxs> ${"</wxs>"} ${`nested </wxs>`}`;',
    '// fake </wxs>\nvar marker = 1;',
    'if (true) /<\\/wxs>/.test("x");',
    'var object = { value: 8 }; var quotient = object.value / 2;',
  ])('skips pseudo script closing tags: %s', (body) => {
    const source = `<wxs>${body}</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })

  it('allows the owner to resolve a WXS trailing comment without an AST dependency', () => {
    const source = '<wxs>module.exports = {}; /* trailing </wxs><view/>'
    const candidates = scanScriptBoundaryCandidates(source, 5, 'wxs')
    expect(candidates.commentClosings).toEqual([{ start: source.indexOf('</wxs>'), end: source.indexOf('</wxs>') + 6, block: true }])
    expect(findTrailingScriptComment('var a = 1; /* trailing')).toBe(11)
    expect(parse(source).diagnostics[0]?.message).toContain('resolveScriptBoundary')
    const document = parse(source, { resolveScriptBoundary: (_source, _start, _name, found) => found.commentClosings?.[0] })
    expect(document.diagnostics).toEqual([])
    expect(document.children).toHaveLength(2)
  })

  it('rejects invalid resolver ranges', () => {
    expect(parse('<wxs>a</wxs>', { resolveScriptBoundary: () => ({ start: 5, end: 100 }) }).diagnostics).not.toEqual([])
  })

  it('keeps case-insensitive script boundary lookup separate from strict tag pairing', () => {
    const source = '<sjs>export default {};</SJS  ><view/>'
    expect(findScriptClosingTag(source, 5, 'sjs')).toEqual({ start: source.indexOf('</SJS'), end: source.indexOf('<view') })
    expect(parse(source).diagnostics[0]?.code).toBe('template/mismatched-tag')
  })

  it('supports explicit raw tags', () => {
    expect(parse('<code>"<view/>"</code>', { rawTags: ['code'] }).diagnostics).toEqual([])
    expect((parse('<code>"<view/>"</code>', { rawTags: ['code'] }).children[0] as ElementNode).children[0]?.kind).toBe('script')
  })

  it('recognizes default raw tags case-insensitively and allows replacing the defaults', () => {
    for (const name of ['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs']) {
      const tag = name.toUpperCase()
      const document = parse(`<${tag}>var value = left<right;</${tag}>`)
      expect(document.diagnostics).toEqual([])
      expect((document.children[0] as ElementNode).children[0]?.kind).toBe('script')
    }
    const regular = parse('<script><text/></script>', { rawTags: [] })
    expect(regular.diagnostics).toEqual([])
    expect((regular.children[0] as ElementNode).children[0]).toMatchObject({ kind: 'element', name: 'text' })
    const custom = parse('<Code.Block>var value = left<right;</Code.Block>', { rawTags: ['code.block'] })
    expect(custom.diagnostics).toEqual([])
    expect((custom.children[0] as ElementNode).children[0]?.kind).toBe('script')
  })
})

describe('attribute decoding and traversal', () => {
  it('decodes XML entities only on request and preserves literal XML backslashes', () => {
    expect(decodeAttribute('&amp;&#32;&quot;', 'xml')).toBe('& "')
    expect(decodeAttribute('&amp;', 'xml', false)).toBe('&amp;')
    expect(decodeAttribute(String.raw`a\b`, 'xml')).toBe(String.raw`a\b`)
    expect(decodeAttribute(String.raw`a\"b`, 'legacy', false, '"')).toBe('a"b')
    expect(decodeAttribute(String.raw`{{ \"a\\\\b\" }}`, 'legacy', false, '"')).toBe(String.raw`{{ "a\\b" }}`)
  })

  it('supports enter/leave and subtree skipping without changing siblings', () => {
    const visits: string[] = []
    walk(parse('<view><skip><text/></skip><keep/></view>'), {
      enter(node, parent) {
        if (node.kind === 'element') {
          visits.push(`+${node.name}:${parent?.name ?? ''}`)
          if (node.name === 'skip') {
            return false as const
          }
        }
      },
      leave(node) {
        if (node.kind === 'element') {
          visits.push(`-${node.name}`)
        }
      },
    })
    expect(visits).toEqual(['+view:', '+skip:view', '-skip', '+keep:view', '-keep', '-view'])
  })

  it('walks deeply nested valid templates without recursive calls', () => {
    const depth = 5000
    const document = parse('<view>'.repeat(depth) + '</view>'.repeat(depth))
    expect(document.diagnostics).toEqual([])
    let count = 0
    walk(document, {
      enter() {
        count++
      },
    })
    expect(count).toBe(depth)
  })
})
