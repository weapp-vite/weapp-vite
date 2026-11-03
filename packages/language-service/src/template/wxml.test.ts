import { describe, expect, it } from 'vitest'
import { findScriptClosingTag, findTrailingScriptComment } from '../script/scanner'
import { getTemplateExpressions } from './expressions'
import { scanTemplate } from './scanner'

describe('shared WXML language service semantics', () => {
  it('retains duplicate, bare, empty and entity-encoded attribute source ranges', () => {
    const source = '<view a="&amp;" disabled empty="" a=raw><text>{{ { a: "}}" } }}</text></view>'
    const result = scanTemplate(source)
    expect(result.diagnostics).toEqual([])
    const [view, text, body, closeText, closeView] = result.tokens
    expect(view).toMatchObject({ kind: 'tag', name: 'view', start: 0, matching: 4 })
    expect(text).toMatchObject({ kind: 'tag', name: 'text', parent: 0, matching: 3 })
    expect(body).toMatchObject({ kind: 'text', start: source.indexOf('{{'), end: source.indexOf('</text>') })
    expect(closeText).toMatchObject({ kind: 'tag', closing: true, name: 'text', matching: 1, parent: 0 })
    expect(closeView).toMatchObject({ kind: 'tag', closing: true, name: 'view', matching: 0 })
    if (view?.kind !== 'tag') {
      throw new Error('Expected an opening tag.')
    }
    expect(view.attributes.map(attribute => [attribute.name, attribute.value, attribute.quote])).toEqual([
      ['a', '&amp;', '"'],
      ['disabled', undefined, undefined],
      ['empty', '', '"'],
      ['a', 'raw', undefined],
    ])
    for (const attribute of view.attributes) {
      expect(source.slice(attribute.nameStart, attribute.nameEnd)).toBe(attribute.name)
      if (attribute.valueStart !== undefined) {
        expect(source.slice(attribute.valueStart, attribute.valueEnd)).toBe(attribute.value)
      }
    }
  })

  it('keeps comments, CDATA, declarations and raw script bodies opaque', () => {
    const body = 'var value = "<view/>"; /* fake </wxs> */'
    const source = `<!--x--><![CDATA[<view/>]]><?xml version="1.0"?><wxs>${body}</wxs><view/>`
    const result = scanTemplate(source)
    expect(result.diagnostics).toEqual([])
    expect(result.tokens.map(token => token.kind)).toEqual(['comment', 'cdata', 'declaration', 'tag', 'script', 'tag', 'tag'])
    expect(result.tokens[4]).toEqual({ kind: 'script', tagName: 'wxs', start: source.indexOf(body), end: source.indexOf(body) + body.length })
  })

  it.each(['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'])('retains the global raw-tag contract for %s', (tag) => {
    const source = `<${tag}>var value = left<right;</${tag}>`
    expect(scanTemplate(source).tokens.map(token => token.kind)).toEqual(['tag', 'script', 'tag'])
  })

  it('returns independent mutable empty attribute arrays and mutable result arrays', () => {
    const result = scanTemplate('<view/><text/>')
    const first = result.tokens[0]
    const second = result.tokens[1]
    if (first?.kind !== 'tag' || second?.kind !== 'tag') {
      throw new Error('Expected opening tags.')
    }
    first.attributes.push({ name: 'added', start: 0, end: 0, nameStart: 0, nameEnd: 0 })
    expect(first.attributes.splice(0, 1)).toHaveLength(1)
    expect(second.attributes).toEqual([])
    result.tokens.splice(0, 1)
    result.diagnostics.push({ code: 'custom', message: '可变诊断', severity: 'info', start: 0, end: 0 })
    expect(result.tokens).toHaveLength(1)
    expect(result.diagnostics).toHaveLength(1)
  })

  it('keeps XML backslashes literal and preserves encoded expression boundaries', () => {
    const expression = '{{ fn(&quot;}}&quot;) }}'
    const source = String.raw`<view path="tail\" value="${expression}"/><tail/>`
    const result = scanTemplate(source)
    expect(result.diagnostics).toEqual([])
    const opening = result.tokens[0]
    expect(opening?.kind === 'tag' && opening.attributes[0]?.value).toBe('tail\\')
    expect(getTemplateExpressions(source)).toEqual([
      { start: source.indexOf('{{') + 2, end: source.indexOf(' }}') + 1, fullStart: source.indexOf('{{'), fullEnd: source.indexOf(' }}') + 3, source: ' fn(&quot;}}&quot;) ' },
    ])
  })

  it.each([
    '<wxs>module.exports = {}; /* trailing </wxs><view/>',
    '<wxs>module.exports = {}; // tail </wxs><view/>',
  ])('retains AST-assisted trailing-comment boundary selection: %s', (source) => {
    const start = source.indexOf('</wxs>')
    expect(findScriptClosingTag(source, 5, 'wxs')).toEqual({ start, end: start + 6 })
    expect(scanTemplate(source).diagnostics).toEqual([])
  })

  it('skips complete comments, strings, member-keyword divisions and regexes before the closing tag', () => {
    const source = '<wxs>/* fake </wxs> */ var text = "</wxs>"; object.in / 2; if (true) /<\\/wxs>/.test(text);</wxs>'
    const start = source.lastIndexOf('</wxs>')
    expect(findScriptClosingTag(source, 5, 'wxs')).toEqual({ start, end: source.length })
    expect(findTrailingScriptComment('var value = "/*"; /* trailing')).toBe(18)
  })

  it('reports invalid structure without fabricating a writable complete tree', () => {
    const result = scanTemplate('<view><text></view>')
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'template/mismatched-tag', severity: 'error', start: 12 }))
  })
})
