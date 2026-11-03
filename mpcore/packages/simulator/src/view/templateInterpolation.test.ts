import { describe, expect, it } from 'vitest'
import { isTemplateExpression, templateInterpolations } from './templateInterpolation'
import { interpolateTemplateText } from './templateText'
import { parseWxsTemplateDocument } from './wxsDocument'

describe('WXML interpolation and attribute boundaries', () => {
  it('preserves ordinary attributes and literal text backslashes', () => {
    const source = '<view title="中文 &quot; {{value}}" count="{{42}}"><text>plain</text></view>'
    const textEscape = source.replace('plain', String.raw`path\file`)
    const escaped = parseWxsTemplateDocument(textEscape).children[0]?.children?.[0]
    expect(escaped?.children?.[0]?.children?.[0]?.data).toBe(String.raw`path\file`)
    const page = parseWxsTemplateDocument(source).children[0]!
    expect(page.children?.[0]?.attribs).toEqual({ title: '中文 &quot; {{value}}', count: '{{42}}' })
  })

  it('decodes escaped attributes alongside ordinary raw entity values', () => {
    const source = String.raw`<view title="a\"b" data-static="&amp;" value="{{value}}"/>`
    const page = parseWxsTemplateDocument(source).children[0]!
    expect(page.children?.[0]?.attribs).toEqual({ 'title': 'a"b', 'data-static': '&amp;', 'value': '{{value}}' })
  })

  it('keeps quoted delimiters, object literals and adjacent bindings separate', () => {
    const source = `pre{{'{{literal}}'}}{{({ name: '}' }).name}}post`
    expect(templateInterpolations(source).map(range => range.expression)).toEqual(['\'{{literal}}\'', '({ name: \'}\' }).name'])
    expect(interpolateTemplateText(source, {})).toBe('pre{{literal}}}post')
    expect(isTemplateExpression(`{{'{{literal}}'}}`)).toBe(true)
    expect(isTemplateExpression('{{a}}{{b}}')).toBe(false)
    expect(interpolateTemplateText('{{unclosed', {})).toBe('{{unclosed')
  })

  it('uses shared regexp, template-string and comment boundaries without losing incomplete-text tolerance', () => {
    const template = '`text }} $' + '{value}`'
    const source = `{{ /}}/.test(value) }}{{ ${template} }}{{ value /* }} */ }}tail{{unfinished`
    expect(templateInterpolations(source).map(range => range.expression)).toEqual([
      ' /}}/.test(value) ',
      ` ${template} `,
      ' value /* }} */ ',
    ])
    expect(templateInterpolations('{{call(}}after{{value}}').map(range => range.expression)).toEqual(['call(', 'value'])
    expect(interpolateTemplateText('prefix{{value}}tail{{unfinished', { value: 'ok' })).toBe('prefixoktail{{unfinished')
  })

  it('does not alter comments, WXS bodies or former placeholder-looking values', () => {
    const source = String.raw`<!-- <view a="\""/> --><view title="a\"b" data-token=__mpcore_quoted_attribute_0 /><wxs module="x">var x = '<view title="ignored"/>';</wxs>`
    const document = parseWxsTemplateDocument(source)
    const page = document.children[0]!
    const view = page.children?.find(node => node.name === 'view')
    expect(view?.attribs?.title).toBe('a"b')
    expect(view?.attribs?.['data-token']).toBe('__mpcore_quoted_attribute_0')
    const wxs = page.children?.find(node => node.name === 'wxs')
    expect(wxs?.children?.[0]?.data).toBe(`var x = '<view title="ignored"/>';`)
  })

  describe.each([
    { path: 'single-line template', prefix: '', attributes: '' },
    { path: 'restored attribute', prefix: '', attributes: String.raw` title="a\"b"` },
    { path: 'restored WXS body', prefix: '<wxs module="spaces">  var value = " ";  </wxs>', attributes: '' },
  ])('$path static whitespace', ({ prefix, attributes }) => {
    it.each([' ', '   ', '\t', '\r\n  '])('removes ASCII-only source nodes containing %j before interpolation', (space) => {
      const source = `${prefix}<view${attributes}><text>A</text>${space}<text>B</text><text>${space}</text></view>`
      const document = parseWxsTemplateDocument(source)
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
    const document = parseWxsTemplateDocument(source)
    const view = document.children?.[0]?.children?.[0]
    expect(view?.children?.map(node => node.children?.[0]?.data)).toEqual([
      `{{' '}}`,
      '{{space}}',
      '  A  B  ',
      'prefix  {{label}}  suffix',
    ])
  })
})
