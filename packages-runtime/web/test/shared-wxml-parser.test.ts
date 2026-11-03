import type { Element as DomElement } from 'domhandler'
import { CDATA, Comment, Document, Element, ProcessingInstruction, Text } from 'domhandler'
import { describe, expect, it } from 'vitest'
import { parseWxml as parseSharedWxml } from '../src/compiler/wxml/parser'
import { createTemplate, renderTemplate } from '../src/runtime/legacyTemplate'
import { parseSharedTemplateNodes } from '../src/runtime/legacyTemplate/parser'

describe('shared WXML parsing for Web', () => {
  it('keeps markup inside expressions and script strings out of the element tree', () => {
    const source = '<wxs module="tools">module.exports = { tag: "<view>" }</wxs><text>{{a<b ? "}}" : text}}</text>'
    const nodes = parseSharedWxml(source)
    expect(nodes).toMatchObject([
      { type: 'element', name: 'wxs', children: [{ type: 'text', data: 'module.exports = { tag: "<view>" }' }] },
      { type: 'element', name: 'text', children: [{ type: 'text', data: '{{a<b ? "}}" : text}}' }] },
    ])
  })

  it('keeps Web markup case and decodes source values once', () => {
    const nodes = parseSharedWxml('<svg viewBox="0 0 10 10"><linearGradient id="a&amp;b" /></svg>')
    expect(nodes[0]).toMatchObject({ name: 'svg', attribs: { viewBox: '0 0 10 10' }, children: [{ name: 'linearGradient', attribs: { id: 'a&b' } }] })
    expect(parseSharedTemplateNodes('<view title="a&amp;b">&lt;safe&gt;</view>')[0]).toMatchObject({ name: 'view', attribs: { title: 'a&b' }, children: [{ data: '<safe>' }] })
  })

  it('keeps prototype-shaped attribute names as ordinary first-value entries', () => {
    const source = '<view __proto__="safe" constructor="first" constructor="second" />'
    for (const nodes of [parseSharedWxml(source), parseSharedTemplateNodes(source)]) {
      const element = nodes[0] as { attribs: Record<string, string> }
      expect(Object.hasOwn(element.attribs, '__proto__')).toBe(true)
      expect(Object.getOwnPropertyDescriptor(element.attribs, '__proto__')?.value).toBe('safe')
      expect(element.attribs.constructor).toBe('first')
      expect(Object.getPrototypeOf(element.attribs)).toBeNull()
    }
  })

  it('keeps ordinary custom and SVG filter children in the element tree', () => {
    const source = '<filter><view /></filter><svg><filter id="blur"><feGaussianBlur stdDeviation="2" /></filter></svg>'
    for (const nodes of [parseSharedWxml(source), parseSharedTemplateNodes(source)]) {
      expect(nodes).toMatchObject([
        { name: 'filter', children: [{ name: 'view' }] },
        { name: 'svg', children: [{ name: 'filter', children: [{ name: 'feGaussianBlur' }] }] },
      ])
    }
  })

  it.each([
    ['weapp', 'wxs'],
    ['alipay', 'import-sjs'],
    ['swan', 'import-sjs'],
    ['tt', 'sjs'],
    ['jd', 'wxs'],
    ['xhs', 'wxs'],
  ] as const)('selects native script tags from the explicit %s input platform', (platform, tag) => {
    const source = `<${tag}>const value = "<view>&amp;"</${tag}>`
    for (const nodes of [parseSharedWxml(source, { platform }), parseSharedTemplateNodes(source, { platform })]) {
      expect(nodes[0]).toMatchObject({ name: tag, children: [{ data: 'const value = "<view>&amp;"' }] })
    }
  })

  it('allows explicit raw-tag overrides', () => {
    const source = '<filter>const value = "<view>"</filter>'
    expect(parseSharedWxml(source, { rawTags: ['filter'] })[0]).toMatchObject({ name: 'filter', children: [{ data: 'const value = "<view>"' }] })
    expect(() => parseSharedWxml(source)).toThrow('[web]')
  })

  it('keeps the compiler XML default and uses the explicitly supplied input syntax', () => {
    const source = String.raw`<view title="a\b" />`
    expect(parseSharedWxml(source)[0]).toMatchObject({ attribs: { title: String.raw`a\b` } })
    expect(parseSharedWxml(source, { platform: 'weapp' })[0]).toMatchObject({ attribs: { title: 'ab' } })
    expect(parseSharedWxml(source, { platform: 'weapp', syntax: 'xml' })[0]).toMatchObject({ attribs: { title: String.raw`a\b` } })
    expect(parseSharedWxml(source, { platform: 'tt' })[0]).toMatchObject({ attribs: { title: String.raw`a\b` } })
    expect(parseSharedTemplateNodes(source)[0]).toMatchObject({ attribs: { title: 'ab' } })
    expect(parseSharedTemplateNodes(source, { platform: undefined })[0]).toMatchObject({ attribs: { title: 'ab' } })
    expect(parseSharedTemplateNodes(source, { syntax: 'xml' })[0]).toMatchObject({ attribs: { title: String.raw`a\b` } })
    const quoted = String.raw`<view title="{{ \"value\" }}" />`
    expect(parseSharedWxml(quoted, { platform: 'weapp' })[0]).toMatchObject({ attribs: { title: '{{ "value" }}' } })
  })

  it('keeps compiler recursive filtering and legacy root-only filtering separate', () => {
    const source = ' \n<!--root--><?root value?><view> \n<!--nested--><?child value?><![CDATA[<literal>]]><text>ok</text> </view> \n'
    expect(parseSharedWxml(source)).toMatchObject([{ name: 'view', children: [{ name: 'text', children: [{ data: 'ok' }] }] }])
    const nodes = parseSharedTemplateNodes(source)
    expect(nodes).toHaveLength(1)
    const view = nodes[0] as DomElement
    expect(view.children.map(node => node.type)).toEqual(['text', 'comment', 'directive', 'cdata', 'tag', 'text'])
    expect(view.children[0]).toBeInstanceOf(Text)
    expect(view.children[1]).toBeInstanceOf(Comment)
    expect(view.children[2]).toBeInstanceOf(ProcessingInstruction)
    expect(view.children[3]).toBeInstanceOf(CDATA)
    expect(view.children[3]).toMatchObject({ children: [{ data: '<literal>' }] })
  })

  it('retains conditional adjacency behavior around nested whitespace and comments', () => {
    const source = '<view><text wx:if="{{ready}}">first</text>\n<!--boundary--><text wx:else>second</text></view>'
    const nodes = parseSharedTemplateNodes(source)
    expect(renderTemplate(nodes, { ready: true })).toBe(createTemplate(source)({ ready: true }))
    expect(renderTemplate(nodes, { ready: false })).toBe(createTemplate(source)({ ready: false }))
    expect((nodes[0] as DomElement).children.map(node => node.type)).toEqual(['tag', 'text', 'comment', 'tag'])
  })

  it('retains root CDATA for legacy generic-container rendering without decoding its content', () => {
    const source = '<![CDATA[<literal>&amp;]]><view />'
    const nodes = parseSharedTemplateNodes(source)
    expect(nodes[0]).toBeInstanceOf(CDATA)
    expect(nodes[0]).toMatchObject({ children: [{ data: '<literal>&amp;' }] })
    expect(parseSharedWxml(source)).toMatchObject([{ name: 'view' }])
    expect(renderTemplate(nodes)).toBe(createTemplate(source)())
  })

  it('creates complete domhandler nodes and links parents and siblings', () => {
    const source = ' \n<view><text>first</text><!--middle--><text>last</text></view><view />'
    const nodes = parseSharedTemplateNodes(source)
    const view = nodes[0] as DomElement
    expect(view).toBeInstanceOf(Element)
    expect(view.parent).toBeInstanceOf(Document)
    expect(view.parent!.children).toBe(nodes)
    expect(view.prev).toBeNull()
    expect(view.next).toBe(nodes[1])
    expect(nodes[1]!.prev).toBe(view)
    expect(nodes[1]!.next).toBeNull()
    expect(view.firstChild).toBe(view.children[0])
    expect(view.lastChild).toBe(view.children[2])
    expect(view.children[1]!.previousSibling).toBe(view.children[0])
    expect(view.children[1]!.nextSibling).toBe(view.children[2])
    expect(view.children.every(node => node.parent === view)).toBe(true)
    expect(view.cloneNode(true)).toBeInstanceOf(Element)
    expect(view.startIndex).toBe(source.indexOf('<view>'))
    expect(view.endIndex).toBe(source.indexOf('</view>') + '</view>'.length - 1)
  })

  it('lowers deeply nested templates without adding a recursive stack limit', () => {
    const depth = 6000
    const source = `${'<view>'.repeat(depth)}value${'</view>'.repeat(depth)}`
    const compiler = parseSharedWxml(source)
    const legacy = parseSharedTemplateNodes(source)
    let compilerNode = compiler[0]!
    let legacyNode = legacy[0]!
    for (let index = 1; index < depth; index++) {
      expect(compilerNode.type).toBe('element')
      compilerNode = compilerNode.type === 'element' ? compilerNode.children![0]! : compilerNode
      legacyNode = (legacyNode as DomElement).children[0]!
    }
    expect(compilerNode).toMatchObject({ children: [{ data: 'value' }] })
    expect(legacyNode).toMatchObject({ children: [{ data: 'value' }] })
  })
})
