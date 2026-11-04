import type { ElementNode } from './types'
import { describe, expect, it } from 'vitest'
import { edit, parse, scan, serialize } from './index'

describe('native template adjacent quoted attributes', () => {
  it.each([
    '<view class="x"bindtap="tap">ok</view>',
    '<view a="1"b=\'2\'bare empty=""duplicate="a"duplicate="b"/>',
    '<view wx:if="{{!(cihui)}}"class="bg1"/>',
  ])('retains ordered attributes and source ranges in %s', (source) => {
    const document = parse(source)
    expect(document.diagnostics).toEqual([])
    expect(scan(source).tokens).toEqual(document.tokens)
    const element = document.children[0] as ElementNode
    expect(element.attributes.length).toBeGreaterThan(1)
    for (const attribute of element.attributes) {
      expect(source.slice(attribute.nameStart, attribute.nameEnd)).toBe(attribute.name)
    }
    expect(serialize(document)).toBe(source)
    const canonical = serialize(document, { mode: 'canonical' })
    const reparsed = parse(canonical)
    expect(reparsed.diagnostics).toEqual([])
    expect(serialize(reparsed, { mode: 'canonical' })).toBe(canonical)
    expect((reparsed.children[0] as ElementNode).attributes.map(attribute => [attribute.name, attribute.value])).toEqual(element.attributes.map(attribute => [attribute.name, attribute.value]))
  })

  it('edits adjacent regions without merging attribute names or losing duplicate order', () => {
    const document = parse('<view a="1"b="2"a="3">old</view>')
    const changed = edit(document, (handle) => {
      if (handle.node.kind === 'element') {
        handle.removeAttribute('b')
        handle.setAttribute('a', 'next')
        handle.setAttribute('c', 'new')
      }
      if (handle.node.kind === 'text') {
        handle.replaceText('next text')
      }
    })
    const output = serialize(changed)
    const reparsed = parse(output)
    expect(reparsed.diagnostics).toEqual([])
    expect((reparsed.children[0] as ElementNode).attributes.map(attribute => [attribute.name, attribute.value])).toEqual([['a', 'next'], ['c', 'new']])
    expect(output).toContain('next text')
  })

  it.each(['legacy', 'xml'] as const)('accepts an unambiguous quoted boundary with %s value syntax', (syntax) => {
    const source = '<view a="1"b="2"hidden empty=""/>'
    const document = parse(source, { syntax })
    expect(document.diagnostics).toEqual([])
    expect((document.children[0] as ElementNode).attributes.map(attribute => [attribute.name, attribute.value])).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['hidden', undefined],
      ['empty', ''],
    ])
    expect(serialize(document)).toBe(source)
  })

  it('rejects an attribute attached to the tag name or a missing name after a quote', () => {
    expect(parse('<view"bad"/>').diagnostics).toContainEqual(expect.objectContaining({ code: 'template/invalid-syntax' }))
    expect(parse('<view a="1"="2"/>').diagnostics).toContainEqual(expect.objectContaining({ code: 'template/invalid-syntax' }))
  })
})
