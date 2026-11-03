import { describe, expect, it } from 'vitest'
import { getScriptModuleTagNames } from '../../utils/wxmlScriptModule'
import { scanTemplate } from './scan'

const scriptTags = new Set(getScriptModuleTagNames())
const scan = (source: string) => scanTemplate(source, 'page.wxml', scriptTags, true, 'legacy')

describe('shared template editing view', () => {
  it('publishes mutable editing views with exact source ranges and parent links', () => {
    const source = '<view a="one" disabled><text>A</text> <!-- keep --> <text>B</text><custom/></view>'
    const result = scan(source)
    expect(result.elements.map(element => element.tag)).toEqual(['view', 'text', 'text', 'custom'])
    const [view, first, second, custom] = result.elements
    expect(first?.parent).toBe(view)
    expect(second?.parent).toBe(view)
    expect(second?.previous).toBe(first)
    expect(custom?.previous).toBe(second)
    expect(view?.attrs.map(attribute => [attribute.name, source.slice(attribute.valueStart, attribute.valueEnd)]))
      .toEqual([['a', 'one'], ['disabled', '']])
    expect(source.slice(view!.start, view!.end)).toBe(source)
    expect(source.slice(first!.start, first!.end)).toBe('<text>A</text>')
    expect(result.comments).toEqual([{ start: source.indexOf('<!--'), end: source.indexOf('-->') + 3 }])
    first!.removed = true
    expect(first!.removed).toBe(true)
  })

  it.each(['between', '{{ value }}', '<![CDATA[ ]]>'])('breaks conditional sibling chains at meaningful content: %s', (content) => {
    const [view, first, second, third] = scan(`<view><first/>${content}<second/><third/></view>`).elements
    expect(first?.parent).toBe(view)
    expect(second?.previous).toBeUndefined()
    expect(third?.previous).toBe(second)
  })

  it('keeps comments and declarations transparent to sibling chains', () => {
    const [, first, second, third] = scan('<view><first/><!-- keep --><second/><?tool x?><third/></view>').elements
    expect(second?.previous).toBe(first)
    expect(third?.previous).toBe(second)
  })

  it('keeps raw scripts opaque and resolves AST-assisted trailing comments', () => {
    const source = '<wxs>var value = "</wxs><debug/>"; /* fake </wxs> */</wxs><view/>'
    expect(scan(source).elements.map(element => element.tag)).toEqual(['wxs', 'view'])
    expect(scan('<wxs>module.exports = {}; /* tail </wxs><view/>').elements.map(element => element.tag)).toEqual(['wxs', 'view'])
  })

  it('preserves the comment-only cutoff without parsing inactive malformed suffixes', () => {
    const source = '<view><!--keep--><bad value="unterminated'
    expect(scanTemplate(source, 'page.wxml', scriptTags, true, 'legacy', false))
      .toEqual({ elements: [], comments: [{ start: 6, end: 17 }] })
    for (const opaque of [
      '<wxs>var value = "<!--script-->";</wxs>',
      '<![CDATA[<!--cdata-->]]>',
      '<view title="<!--attribute-->">{{ "<!--expression-->" }}</view>',
      '<view>',
    ]) {
      expect(scanTemplate(opaque, 'page.wxml', scriptTags, true, 'legacy', false))
        .toEqual({ elements: [], comments: [] })
    }
  })

  it('keeps literal XML backslashes and caller-owned raw-tag selection', () => {
    const source = String.raw`<view title="slash\" data-test="drop"><!--ordinary--></view>`
    const result = scanTemplate(source, 'page.axml', scriptTags, true, 'xml')
    expect(source.slice(result.elements[0]!.attrs[0]!.valueStart, result.elements[0]!.attrs[0]!.valueEnd)).toBe('slash\\')
    expect(scanTemplate('<filter><child/></filter>', 'page.wxml', new Set(['wxs']), false, 'xml').elements.map(element => element.tag))
      .toEqual(['filter', 'child'])
  })

  it('reports invalid structure and unterminated attribute locations before returning editing views', () => {
    expect(() => scan('<view><text></view>')).toThrow('[weapp.wxml] page.wxml:1:13:')
    expect(() => scan('<view\r\n  title="unterminated>')).toThrow('[weapp.wxml] page.wxml:2:3:')
  })
})
