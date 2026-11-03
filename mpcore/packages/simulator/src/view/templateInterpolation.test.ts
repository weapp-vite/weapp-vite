import type { TemplateNodeLike } from './templateRuntime'
import { describe, expect, it } from 'vitest'
import { maskTemplateAttributes } from './templateAttributes'
import { isTemplateExpression, templateInterpolations } from './templateInterpolation'
import { interpolateTemplateText } from './templateText'
import { parseWxsTemplateDocument } from './wxsDocument'

describe('WXML interpolation and attribute boundaries', () => {
  it('does not allocate placeholders for ordinary attributes or literal text backslashes', () => {
    const source = '<view title="中文 &quot; {{value}}" count="{{42}}"><text>plain</text></view>'
    expect(maskTemplateAttributes(source)).toEqual({ source, attributes: new Map() })
    const textEscape = source.replace('plain', String.raw`path\file`)
    expect(maskTemplateAttributes(textEscape)).toEqual({ source: textEscape, attributes: new Map() })
    const page = parseWxsTemplateDocument(source).children[0] as any
    expect(page.children[0].attribs).toEqual({ title: '中文 &quot; {{value}}', count: '{{42}}' })
  })

  it('only masks escaped attributes when ordinary and escaped values share a template', () => {
    const source = String.raw`<view title="a\"b" data-static="&amp;" value="{{value}}"/>`
    const masked = maskTemplateAttributes(source)
    expect(masked.attributes.size).toBe(1)
    expect(masked.source).toContain('data-static="&amp;" value="{{value}}"')
    const page = parseWxsTemplateDocument(source).children[0] as any
    expect(page.children[0].attribs).toEqual({ 'title': 'a"b', 'data-static': '&amp;', 'value': '{{value}}' })
  })

  it('keeps quoted delimiters, object literals and adjacent bindings separate', () => {
    const source = `pre{{'{{literal}}'}}{{({ name: '}' }).name}}post`
    expect(templateInterpolations(source).map(range => range.expression)).toEqual(['\'{{literal}}\'', '({ name: \'}\' }).name'])
    expect(interpolateTemplateText(source, {})).toBe('pre{{literal}}}post')
    expect(isTemplateExpression(`{{'{{literal}}'}}`)).toBe(true)
    expect(isTemplateExpression('{{a}}{{b}}')).toBe(false)
    expect(interpolateTemplateText('{{unclosed', {})).toBe('{{unclosed')
  })

  it('does not alter comments or WXS bodies and avoids placeholder collisions', () => {
    const source = String.raw`<!-- <view a="\""/> --><view title="a\"b" data-token=__mpcore_quoted_attribute_0 /><wxs module="x">var x = '<view title="ignored"/>';</wxs>`
    const masked = maskTemplateAttributes(source)
    expect(masked.source).toContain('<!-- <view a=')
    const document = parseWxsTemplateDocument(source)
    const page = document.children[0] as any
    const view = page.children.find((node: any) => node.name === 'view')
    expect(view.attribs.title).toBe('a"b')
    expect(view.attribs['data-token']).toBe('__mpcore_quoted_attribute_0')
    const wxs = page.children.find((node: any) => node.name === 'wxs')
    expect(wxs.children[0].data).toBe(`var x = '<view title="ignored"/>';`)
  })

  describe.each([
    { path: 'single-line template', prefix: '', attributes: '' },
    { path: 'restored attribute', prefix: '', attributes: String.raw` title="a\"b"` },
    { path: 'restored WXS body', prefix: '<wxs module="spaces">  var value = " ";  </wxs>', attributes: '' },
  ])('$path static whitespace', ({ prefix, attributes }) => {
    it.each([' ', '   ', '\t', '\r\n  '])('removes ASCII-only source nodes containing %j before interpolation', (space) => {
      const source = `${prefix}<view${attributes}><text>A</text>${space}<text>B</text><text>${space}</text></view>`
      const document = parseWxsTemplateDocument(source) as unknown as TemplateNodeLike
      const page = document.children?.[0]
      const view = page?.children?.find(node => node.name === 'view')
      expect(view?.children?.filter(node => node.type === 'text')).toEqual([])
      expect(view?.children?.[0]?.children?.[0]?.data).toBe('A')
      expect(view?.children?.[1]?.children?.[0]?.data).toBe('B')
      expect(view?.children?.[2]?.children).toEqual([])
      if (prefix) {
        const wxs = page?.children?.find(node => node.name === 'wxs')
        expect(wxs?.children?.[0]?.data).toBe('  var value = " ";  ')
      }
      if (attributes) {
        expect(view?.attribs?.title).toBe('a"b')
      }
    })
  })

  it('keeps explicit whitespace bindings and nonempty source text unchanged', () => {
    const source = `<view><text>{{' '}}</text><text>{{space}}</text><text>  A  B  </text><text>prefix  {{label}}  suffix</text></view>`
    const document = parseWxsTemplateDocument(source) as unknown as TemplateNodeLike
    const view = document.children?.[0]?.children?.[0]
    expect(view?.children?.map(node => node.children?.[0]?.data)).toEqual([
      `{{' '}}`,
      '{{space}}',
      '  A  B  ',
      'prefix  {{label}}  suffix',
    ])
  })
})
