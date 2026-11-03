import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { parseSharedDocument, parseSharedWxsDocument, sourceAttributeForms } from './sharedDocument'

interface StructuralNode {
  type?: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: StructuralNode[]
  parent?: StructuralNode | null
  prev?: StructuralNode | null
  next?: StructuralNode | null
}

function project(node: StructuralNode): unknown {
  return {
    type: node.type,
    name: node.name,
    data: node.data,
    attribs: node.attribs,
    hasChildren: Object.hasOwn(node, 'children'),
    children: node.children?.map(project),
  }
}

function assertLinks(node: StructuralNode) {
  expect(Object.getPrototypeOf(node)).toBe(Object.prototype)
  for (const [index, child] of (node.children ?? []).entries()) {
    expect(child.parent).toBe(node)
    expect(child.prev).toBe(node.children?.[index - 1] ?? null)
    expect(child.next).toBe(node.children?.[index + 1] ?? null)
    assertLinks(child)
  }
}

describe('shared source tree adapter', () => {
  it.each([
    '<?xml version="1.0"?><!DOCTYPE root><!-- opaque --><Root A=plain bare empty="" dup=first dup="second" ><Child>text &amp;</Child></Root>',
    '<root><![CDATA[ <view/> ]]><![CDATA[ ]]><!--x--><Form><form/></Form></root>',
    '<probe __proto__ constructor=first constructor=second toString /><view title="&amp; &quot; &#34;"/>',
  ])('matches the legacy valid-tree shape without class or parser dependencies: %s', (source) => {
    const legacy = parseDocument(source, { xmlMode: true, decodeEntities: false, lowerCaseTags: false, lowerCaseAttributeNames: false, recognizeSelfClosing: true })
    const document = parseSharedDocument(source)
    expect(project(document)).toEqual(project(legacy))
    assertLinks(document)
  })

  it('preserves first duplicate forms and carries metadata through clones', () => {
    const document = parseSharedWxsDocument('<probe bare bare="" empty="" empty />')
    const node = document.children[0]?.children?.[0]
    expect(node?.attribs).toEqual({ bare: '', empty: '' })
    expect([...sourceAttributeForms(node!)!]).toEqual(['bare'])
    expect(sourceAttributeForms({ ...node })).toBe(sourceAttributeForms(node!))
  })

  it('decodes only quoted legacy escapes and preserves raw entity and unquoted slash values', () => {
    const document = parseSharedWxsDocument(String.raw`<probe quoted="path\\file\"x" unquoted=path\file entity="&amp;" bound="{{\"a\\\\b\"}}"/>`)
    const node = document.children[0]?.children?.[0]
    expect(node?.attribs).toEqual({
      quoted: String.raw`path\file"x`,
      unquoted: String.raw`path\file`,
      entity: '&amp;',
      bound: String.raw`{{"a\\b"}}`,
    })
  })

  it('decodes the complete legacy attribute layer and preserves logical JS bindings', () => {
    const source = String.raw`<probe static="a\"b &amp;"
      data-single-escape="{{'a\\'b'}}"
      data-double-escape="{{\"a\\\"b\"}}"
      data-single-tail="{{'tail\\\\'}}"
      data-double-tail="{{\"tail\\\\\"}}"
      data-single-mixed="{{'a\\\\\\'b'}}"
      data-double-mixed="{{\"a\\\\\\\"b\"}}"
      data-symbols="{{'<>&'}}"
      data-comparison="{{1 < 2 && 3 > 2}}"
      data-bitwise="{{7 & 3}}"
      data-expression-entity="{{'&amp;'}}"/>`
    const node = parseSharedWxsDocument(source).children[0]?.children?.[0]
    expect(node?.attribs).toEqual({
      'static': 'a"b &amp;',
      'data-single-escape': String.raw`{{'a\'b'}}`,
      'data-double-escape': String.raw`{{"a\"b"}}`,
      'data-single-tail': String.raw`{{'tail\\'}}`,
      'data-double-tail': String.raw`{{"tail\\"}}`,
      'data-single-mixed': String.raw`{{'a\\\'b'}}`,
      'data-double-mixed': String.raw`{{"a\\\"b"}}`,
      'data-symbols': `{{'<>&'}}`,
      'data-comparison': '{{1 < 2 && 3 > 2}}',
      'data-bitwise': '{{7 & 3}}',
      'data-expression-entity': `{{'&amp;'}}`,
    })
  })

  it.each(['', ' \t\r\n ', 'var ok = a<b; var fake = "</wxs>"; /* </wxs> */'])('keeps exact raw WXS body %j while filtering ordinary ASCII whitespace', (body) => {
    const document = parseSharedWxsDocument(`\n<wxs module="m">${body}</wxs>\n<text>{{a<b}}</text>\n`)
    const page = document.children[0]!
    expect(page.children).toHaveLength(2)
    const wxs = page.children?.[0]
    const script = wxs?.children?.[0]
    expect(script?.data).toBe(body)
    expect(Object.hasOwn(script!, 'children')).toBe(false)
    expect(page.children?.[1]?.children?.[0]?.data).toBe('{{a<b}}')
    assertLinks(document)
  })

  it('retains CDATA whitespace independently of unrelated escaped attributes', () => {
    for (const attributes of ['', String.raw` title="a\"b"`]) {
      const document = parseSharedWxsDocument(`<view${attributes}><![CDATA[ ]]></view>`)
      const cdata = document.children[0]?.children?.[0]?.children?.[0]
      expect(cdata?.type).toBe('cdata')
      expect(cdata?.children?.[0]?.data).toBe(' ')
      const child = cdata?.children?.[0]
      expect(Object.hasOwn(child!, 'children')).toBe(false)
      assertLinks(document)
    }
  })

  it('keeps platform-specific raw tags as ordinary simulator elements', () => {
    const document = parseSharedWxsDocument('<filter><text>filter</text></filter><script><text>script</text></script><sjs><text>sjs</text></sjs>')
    const page = document.children[0]!
    expect(page.children?.map(node => node.children?.[0]?.name)).toEqual(['text', 'text', 'text'])
  })

  it('preserves commented WXS bytes without exposing a module or placeholder', () => {
    const source = '<!-- <wxs module="commentedExternal" src="./must-not-load.wxs"></wxs> --><!-- <wxs module="commentedInline">exports.value = \'must-not-execute\';</wxs> -->'
    const page = parseSharedWxsDocument(source).children[0]!
    expect(page.children?.map(node => ({ type: node.type, name: node.name, data: node.data }))).toEqual([
      { type: 'comment', name: undefined, data: ' <wxs module="commentedExternal" src="./must-not-load.wxs"></wxs> ' },
      { type: 'comment', name: undefined, data: ' <wxs module="commentedInline">exports.value = \'must-not-execute\';</wxs> ' },
    ])
    assertLinks(page)
  })

  it('rejects malformed source explicitly instead of inventing a recovered writable tree', () => {
    expect(() => parseSharedWxsDocument('<view>')).toThrow('[simulator]')
    expect(() => parseSharedWxsDocument('<view value="{{unclosed"/>')).toThrow('[simulator]')
  })
})
