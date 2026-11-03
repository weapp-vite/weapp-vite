import type { EditableNode } from '../types'
import { describe, expect, it } from 'vitest'
import { decodeAttribute } from '../decode'
import { parse } from '../parser'
import { serialize } from '../serialize'
import { edit } from './index'

describe('controlled WXML edits', () => {
  it('returns a new document and preserves untouched bytes and both renamed tags', () => {
    const source = '\uFEFF<!-- keep -->\r\n<view  title=\'unchanged\'><text >value</text ></view >\r\n'
    const original = parse(source)
    const next = edit(original, ({ node, rename }) => {
      if (node.kind === 'element' && node.name === 'view') {
        rename('panel')
      }
    })
    expect(next).not.toBe(original)
    expect(serialize(original)).toBe(source)
    expect(serialize(next)).toBe(source.replace('<view', '<panel').replace('</view', '</panel'))
    expect(next.diagnostics).toEqual([])
  })

  it('sets the first duplicate attribute, removes other duplicates, and keeps bare separate', () => {
    const next = edit(parse('<view a="first" untouched=\'raw\' a=second empty="" bare bare=""/>'), (handle) => {
      handle.setAttribute('a', 'updated')
      handle.setBooleanAttribute('empty')
      handle.removeAttribute('bare')
      handle.setAttribute('added', false)
    })
    expect(next.source).toBe('<view a="updated" untouched=\'raw\'  empty   added="{{false}}"/>')
    const node = next.children[0]
    expect(node?.kind).toBe('element')
    if (node?.kind === 'element') {
      expect(node.attributes.map(attribute => [attribute.name, attribute.value])).toEqual([
        ['a', 'updated'],
        ['untouched', 'raw'],
        ['empty', undefined],
        ['added', '{{false}}'],
      ])
    }
  })

  it.each(['legacy', 'xml'] as const)('encodes literals and explicit expressions for %s', (syntax) => {
    const literal = '中文 & "单\'双" \\ {{literal}} <tag>'
    const next = edit(parse('<view/>', { syntax }), (handle) => {
      handle.setAttribute('title', literal)
      handle.setAttribute('count', 42)
      handle.setAttribute('expression', { expression: 'ok ? "yes" : "no"' })
    })
    expect(next.diagnostics).toEqual([])
    const node = next.children[0]
    if (node?.kind !== 'element') {
      throw new Error('Expected an element.')
    }
    expect(decodeAttribute(node.attributes[0]!.value!, syntax, true, '"')).toBe(literal.replace('{{', '{{\'{\'}}{{\'{\'}}'))
    expect(node.attributes[1]?.value).toBe('{{42}}')
    expect(decodeAttribute(node.attributes[2]!.value!, syntax, true, '"')).toBe('{{ok ? "yes" : "no"}}')
  })

  it.each(['legacy', 'xml'] as const)('keeps entity-like strings literal alongside quotes and bindings for %s', (syntax) => {
    const literal = String.raw`&amp; &quot; &#34; & < > " ' \\ {{literal}}`
    const expression = String.raw`label === "&amp;" && count < 3 ? "<tag>" : "&#34;"`
    const next = edit(parse('<view/>', { syntax }), (handle) => {
      handle.setAttribute('literal', literal)
      handle.setAttribute('expression', { expression })
    })
    const node = next.children[0]
    if (node?.kind !== 'element') {
      throw new Error('Expected an element.')
    }
    expect(decodeAttribute(node.attributes[0]!.value!, syntax, true, '"'))
      .toBe(literal.replace('{{', '{{\'{\'}}{{\'{\'}}'))
    expect(decodeAttribute(node.attributes[1]!.value!, syntax, true, '"')).toBe(`{{${expression}}}`)
    expect(next.source).toContain('&amp;amp;')
    expect(next.source).toContain('&lt;')
    expect(serialize(next, { mode: 'canonical' })).toContain('&amp;amp;')
  })

  it('inserts snippets in call order and expands self-closing tags', () => {
    const next = edit(parse('<root><view /></root>'), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        handle.prepend('<head/>')
        handle.append('<tail/>')
      }
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.insertBefore('<before1/>')
        handle.insertBefore('<before2/>')
        handle.prepend('<first/>')
        handle.append('<last/>')
        handle.rename('panel')
        handle.insertAfter('<after/>')
      }
    })
    expect(next.source).toBe('<root><head/><before1/><before2/><panel ><first/><last/></panel><after/><tail/></root>')
  })

  it('replaces and removes subtrees without visiting them or losing sibling edits', () => {
    const visited: string[] = []
    const next = edit(parse('<root><remove><hidden/></remove><replace><hidden/></replace><keep/></root>'), (handle) => {
      if (handle.node.kind !== 'element') {
        return
      }
      visited.push(handle.node.name)
      if (handle.node.name === 'remove') {
        handle.remove()
      }
      if (handle.node.name === 'replace') {
        handle.replaceWith('<new/>')
      }
      if (handle.node.name === 'keep') {
        handle.setBooleanAttribute('visible')
      }
    })
    expect(visited).toEqual(['root', 'remove', 'replace', 'keep'])
    expect(next.source).toBe('<root><new/><keep visible/></root>')
  })

  it('skips requested children and invalidates handles when the session ends', () => {
    let retained: EditableNode | undefined
    const visited: string[] = []
    edit(parse('<root><child/></root>'), (handle) => {
      retained = handle
      if (handle.node.kind === 'element') {
        visited.push(handle.node.name)
      }
      return false
    })
    expect(visited).toEqual(['root'])
    expect(() => retained?.append('<late/>')).toThrow('no longer active')
  })

  it('invalidates removed ancestors and suppresses their registered child edits', () => {
    let root: EditableNode | undefined
    const visited: string[] = []
    const next = edit(parse('<root><child/><unvisited/></root>'), (handle) => {
      if (handle.node.kind !== 'element') {
        return
      }
      visited.push(handle.node.name)
      if (handle.node.name === 'root') {
        root = handle
      }
      if (handle.node.name === 'child') {
        handle.setAttribute('discarded', true)
        root!.remove()
        expect(() => handle.setBooleanAttribute('late')).toThrow('no longer active')
      }
    })
    expect(visited).toEqual(['root', 'child'])
    expect(next.source).toBe('')
  })

  it('invalidates already queued sibling handles when a child replaces its ancestor', () => {
    let parent: EditableNode | undefined
    let child: EditableNode | undefined
    const visited: string[] = []
    const next = edit(parse('<parent><first/><queued><descendant/></queued></parent><outside/>'), (handle) => {
      if (handle.node.kind !== 'element') {
        return
      }
      visited.push(handle.node.name)
      if (handle.node.name === 'parent') {
        parent = handle
      }
      if (handle.node.name === 'first') {
        child = handle
        const mutateChild = handle.setBooleanAttribute
        parent!.replaceWith('<replacement/>')
        expect(() => mutateChild('late')).toThrow('no longer active')
      }
      if (handle.node.name === 'outside') {
        expect(() => child!.remove()).toThrow('no longer active')
        handle.setBooleanAttribute('still-active')
      }
    })
    expect(visited).toEqual(['parent', 'first', 'outside'])
    expect(next.source).toBe('<replacement/><outside still-active/>')
  })

  it('safely replaces text and keeps explicit expressions distinct', () => {
    const literal = edit(parse('<text>old</text>'), (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText('<view> & {{literal}}')
      }
    })
    expect(literal.source).toBe('<text>&lt;view&gt; &amp; {{\'{\'}}{{\'{\'}}literal}}</text>')
    const expression = edit(literal, (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText({ expression: 'value < 2 ? "low" : "high"' })
      }
    })
    expect(expression.source).toBe('<text>{{value < 2 ? "low" : "high"}}</text>')
  })

  it('validates snippets under inherited syntax and raw-tag options', () => {
    const options = { platform: 'alipay' as const, syntax: 'xml' as const, rawTags: ['opaque'] }
    const next = edit(parse('<view/>', options), handle => handle.append('<opaque>let x = "<not-markup>"</opaque>'))
    expect(next.options).toEqual(options)
    expect(next.platform).toBe('alipay')
    expect(next.syntax).toBe('xml')
    expect(next.diagnostics).toEqual([])
    expect(() => edit(parse('<view/>', options), handle => handle.append('<broken>'))).toThrow('Invalid WXML')
  })

  it('rejects invalid documents, invalid names and operations on incompatible nodes', () => {
    expect(() => edit(parse('<view>'), () => {})).toThrow('Invalid WXML')
    expect(() => edit(parse('<view/>'), handle => handle.rename('view><trap'))).toThrow('Invalid WXML name')
    expect(() => edit(parse('text'), handle => handle.setAttribute('name', 'x'))).toThrow('element')
    expect(() => edit(parse('<view/>'), handle => handle.replaceText('x'))).toThrow('text node')
    expect(() => edit(parse('<view/>'), handle => handle.setAttribute('x', Number.NaN))).toThrow('finite')
    expect(() => edit(parse('<view/>'), handle => handle.setAttribute('x', { expression: ' ' }))).toThrow('nonempty')
  })

  it('rejects asynchronous visitors and closes their handles immediately', () => {
    let retained: EditableNode | undefined
    expect(() => edit(parse('<view/>'), ((handle: EditableNode) => {
      retained = handle
      return Promise.resolve()
    }) as never)).toThrow('synchronous')
    expect(() => retained?.remove()).toThrow('no longer active')
  })

  it('settles rejected asynchronous visitors without retaining active handles', async () => {
    let retained: EditableNode | undefined
    const visitor = async (handle: EditableNode) => {
      retained = handle
      await Promise.resolve()
      handle.remove()
    }
    expect(() => edit(parse('<view/>'), visitor as never)).toThrow('synchronous')
    await Promise.resolve()
    await Promise.resolve()
    expect(() => retained?.remove()).toThrow('no longer active')
  })

  it('keeps empty insertions and an unchanged session byte-identical', () => {
    const source = '<view  a=\'raw\'/>\r\n'
    expect(edit(parse(source), (handle) => {
      handle.insertBefore('')
      handle.insertAfter('')
      if (handle.node.kind === 'element') {
        handle.append('')
        handle.prepend('')
      }
    }).source).toBe(source)
  })

  it('publishes updated source ranges and supports another edit without stale metadata', () => {
    const original = parse('<root><text a="x">old</text><untouched/></root>')
    const first = edit(original, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        handle.setAttribute('long', 'added before descendants')
      }
      if (handle.node.kind === 'text') {
        handle.replaceText('a much longer replacement')
      }
    })
    for (const token of first.tokens) {
      if (token.kind === 'tag') {
        expect(first.source.slice(token.nameStart, token.nameEnd)).toBe(token.name)
        for (const attribute of token.attributes) {
          expect(first.source.slice(attribute.nameStart, attribute.nameEnd)).toBe(attribute.name)
          if (attribute.valueStart !== undefined) {
            expect(first.source.slice(attribute.valueStart, attribute.valueEnd)).toBe(attribute.value)
          }
        }
      }
    }
    const second = edit(first, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'text') {
        handle.rename('label')
        handle.removeAttribute('a')
      }
    })
    expect(second.source).toBe('<root long="added before descendants"><label >a much longer replacement</label><untouched/></root>')
    expect(original.source).toBe('<root><text a="x">old</text><untouched/></root>')
    expect(serialize(second, { mode: 'canonical' })).toBe('<root long="added before descendants"><label>a much longer replacement</label><untouched /></root>')
  })
})
