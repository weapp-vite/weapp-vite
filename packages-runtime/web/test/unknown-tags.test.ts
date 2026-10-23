import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml/compile'
import { parseWxml } from '../src/compiler/wxml/parser'
import { collectUnknownTags, formatUnknownTagWarning } from '../src/compiler/wxml/unknownTags'

function tagsOf(source: string, componentTags?: Record<string, string>) {
  return collectUnknownTags(parseWxml(source), componentTags)
}

function warningsOf(source: string, componentTags?: Record<string, string>) {
  const compiled = compileWxml({
    id: '/fake/page.wxml',
    source,
    resolveTemplatePath: (name: string) => `/fake/${name}.wxml`,
    resolveWxsPath: (name: string) => `/fake/${name}.wxs`,
    componentTags,
  })
  return compiled.warnings ?? []
}

describe('collectUnknownTags', () => {
  it('accepts builtin and html tags', () => {
    expect(tagsOf('<view><text>hi</text><image src="x" /><div><span>y</span></div></view>')).toEqual([])
  })

  it('accepts registered custom components', () => {
    expect(tagsOf('<my-card />', { 'my-card': 'my-card' })).toEqual([])
  })

  it('flags a misspelled builtin tag', () => {
    expect(tagsOf('<buton>提交</buton>')).toEqual(['buton'])
  })

  it('flags an unregistered custom component', () => {
    expect(tagsOf('<order-card />')).toEqual(['order-card'])
  })

  it('flags tags nested inside other elements', () => {
    expect(tagsOf('<view><scroll-vie><text>x</text></scroll-vie></view>')).toEqual(['scroll-vie'])
  })

  it('does not flag native components that web does not implement', () => {
    expect(tagsOf('<web-view src="https://example.com" />')).toEqual([])
    expect(tagsOf('<map />')).toEqual([])
  })

  it('deduplicates repeated unknown tags', () => {
    expect(tagsOf('<buton /><buton /><buton />')).toEqual(['buton'])
  })
})

describe('unknown tag warnings', () => {
  it('reports unknown tags through compile warnings', () => {
    const warnings = warningsOf('<view><buton>提交</buton></view>')
    expect(warnings.some(warning => warning.includes('<buton>'))).toBe(true)
  })

  it('emits nothing for a valid template', () => {
    expect(warningsOf('<view><text>ok</text></view>')).toEqual([])
  })

  it('formats a readable message with the file name', () => {
    const message = formatUnknownTagWarning(['buton', 'order-card'], '/pages/order.wxml')
    expect(message).toContain('/pages/order.wxml')
    expect(message).toContain('<buton>')
    expect(message).toContain('<order-card>')
    expect(message).toContain('usingComponents')
  })
})
