import type { EditableNode } from '../types'
import { describe, expect, it } from 'vitest'
import { parse } from '../parser'
import { serialize } from '../serialize'
import { edit } from './index'

describe('WXML script edits in their owner context', () => {
  it('replaces script text containing comparisons, markup strings and fake closing tags', () => {
    const script = 'var ok = a<b; var html = "<view>"; var fake = "</wxs>";'
    const next = edit(parse('<before/><wxs module="m">var old = 0;</wxs><after/>'), (handle) => {
      if (handle.node.kind === 'script') {
        handle.replaceWith(script)
      }
    })
    expect(next.source).toBe(`<before/><wxs module="m">${script}</wxs><after/>`)
    const owner = next.children[1]
    expect(owner?.kind === 'element' && owner.children).toMatchObject([{ kind: 'script', data: script }])
  })

  it('prepends and appends raw code without parsing it as ordinary template fragments', () => {
    const next = edit(parse('<wxs module="m">var middle = 1;</wxs>'), (handle) => {
      if (handle.node.kind === 'element') {
        handle.prepend('var ok = a<b;\n')
        handle.append('\nvar html = "<view>";')
        handle.insertBefore('<outside-before/>')
        handle.insertAfter('<outside-after/>')
      }
      if (handle.node.kind === 'script') {
        handle.insertBefore('var before = 0;\n')
        handle.insertAfter('\nvar fake = "</wxs>";')
      }
    })
    const body = 'var ok = a<b;\nvar before = 0;\nvar middle = 1;\nvar fake = "</wxs>";\nvar html = "<view>";'
    expect(next.source).toBe(`<outside-before/><wxs module="m">${body}</wxs><outside-after/>`)
    expect(serialize(next, { mode: 'canonical' })).toBe(`<outside-before /><wxs module="m">${body}</wxs><outside-after />`)
  })

  it('expands self-closing script owners and honors custom raw tag configuration', () => {
    const next = edit(parse('<opaque />', { rawTags: ['opaque'] }), (handle) => {
      handle.append('var ok = a<b; var tag = "<view>";')
    })
    expect(next.source).toBe('<opaque >var ok = a<b; var tag = "<view>";</opaque>')
    const owner = next.children[0]
    expect(owner?.kind === 'element' && owner.children[0]?.kind).toBe('script')
  })

  it.each(['replaceWith', 'append', 'prepend'] as const)('rejects balanced closing-tag escapes through %s', (operation) => {
    const escaping = 'var a = 1;</wxs><view id="escaped"/><wxs module="other">var b = 2;'
    expect(() => edit(parse('<wxs module="m">var old = 0;</wxs>'), (handle) => {
      if (operation === 'replaceWith' && handle.node.kind === 'script') {
        handle.replaceWith(escaping)
      }
      if (operation !== 'replaceWith' && handle.node.kind === 'element') {
        handle[operation](escaping)
      }
    })).toThrow('original script owner')
  })

  it('keeps fake closings inside comments and strings within the same script body', () => {
    const body = 'var fake = "</wxs>"; /* </wxs> */\n// </wxs>\nvar ok = a<b;'
    const next = edit(parse('<wxs module="m">var old = 0;</wxs>'), (handle) => {
      if (handle.node.kind === 'script') {
        handle.replaceWith(body)
      }
    })
    expect(next.source).toBe(`<wxs module="m">${body}</wxs>`)
    expect(next.children).toHaveLength(1)
  })

  it.each(['remove', 'replaceWith'] as const)('discards raw edits covered by a later ancestor %s', (operation) => {
    let root: EditableNode | undefined
    const next = edit(parse('<root><wxs module="m">old</wxs><last/></root><outside/>'), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        root = handle
      }
      if (handle.node.kind === 'script') {
        handle.replaceWith('var ok = a<b;')
      }
      if (handle.node.kind === 'element' && handle.node.name === 'last') {
        if (operation === 'remove') {
          root!.remove()
        }
        else {
          root!.replaceWith('<replacement/>')
        }
      }
    })
    expect(next.source).toBe(`${operation === 'remove' ? '' : '<replacement/>'}<outside/>`)
  })

  it('passes only complete source to custom script boundary resolvers', () => {
    const sources: string[] = []
    const source = '<view/><wxs module="m">var old = 0;</wxs>'
    const next = edit(parse(source, {
      resolveScriptBoundary(input, _start, _tag, candidates) {
        sources.push(input)
        return candidates.closingTag
      },
    }), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.insertBefore('<long-before/>')
      }
      if (handle.node.kind === 'script') {
        handle.replaceWith('var ok = a<b; var html = "<view>";')
      }
    })
    expect(sources).toEqual([source, next.source])
  })
})
