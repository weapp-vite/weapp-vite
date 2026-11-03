import type { EditableNode } from '../types'
import { describe, expect, it } from 'vitest'
import { decodeAttribute } from '../decode'
import { parse } from '../parser'
import { serialize } from '../serialize'
import { edit } from './index'

describe('final controlled expression boundaries', () => {
  it.each(['legacy', 'xml'] as const)('rejects multiple attribute bindings in %s syntax', (syntax) => {
    expect(() => edit(parse('<view/>', { syntax }), handle => handle.setAttribute('value', { expression: '1}}{{2' })))
      .toThrow('single complete interpolation')
  })

  it.each(['1}}{{2', '1}}</view><injected/><view>{{2'])('rejects text expression boundary escapes: %s', (expression) => {
    expect(() => edit(parse('<view>old</view>'), (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText({ expression })
      }
    })).toThrow('single complete interpolation')
  })

  it.each(['legacy', 'xml'] as const)('keeps delimiters inside expression strings and regular expressions in %s syntax', (syntax) => {
    const expression = '"a}}b" + /}}/.source + "\\\\path"'
    const next = edit(parse('<view>old</view>', { syntax }), (handle) => {
      if (handle.node.kind === 'element') {
        handle.setAttribute('value', { expression })
      }
      else if (handle.node.kind === 'text') {
        handle.replaceText({ expression })
      }
    })
    const canonical = serialize(next, { mode: 'canonical' })
    const root = next.children[0]
    expect(root?.kind).toBe('element')
    if (root?.kind === 'element') {
      const attribute = root.attributes[0]!
      expect(decodeAttribute(attribute.value!, syntax, true, attribute.quote)).toBe(`{{${expression}}}`)
      expect(root.children).toMatchObject([{ kind: 'text', data: `{{${expression}}}` }])
    }
    expect(serialize(next, { mode: 'canonical' })).toBe(canonical)
  })

  it('validates only final text expressions after subsequent replacements', () => {
    const next = edit(parse('<view>old</view>'), (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText({ expression: '1}}</view><injected/><view>{{2' })
        handle.replaceText('safe')
      }
    })
    expect(next.source).toBe('<view>safe</view>')
  })

  it.each(['expression', 'literal'] as const)('allows a raw replacement after %s text without keeping the previous encoding state', (kind) => {
    const next = edit(parse('<view>old</view>'), (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText(kind === 'expression' ? { expression: '1}}{{2' } : 'safe')
        handle.replaceWith('<child/>')
      }
    })
    expect(next.source).toBe('<view><child/></view>')
    const expected = '<view><child /></view>'
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
    expect(next.children).toEqual(parse(next.source).children)
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
  })

  it.each(['remove', 'replaceWith'] as const)('discards covered expression edits after an ancestor %s', (operation) => {
    let parent: EditableNode | undefined
    const next = edit(parse('<root><view>old</view><last/></root><outside/>'), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        parent = handle
      }
      else if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.setAttribute('value', { expression: '1}}{{2' })
      }
      else if (handle.node.kind === 'text') {
        handle.replaceText({ expression: '1}}</view><injected/><view>{{2' })
      }
      else if (handle.node.kind === 'element' && handle.node.name === 'last') {
        if (operation === 'remove') {
          parent!.remove()
        }
        else {
          parent!.replaceWith('<replacement/>')
        }
      }
    })
    expect(next.source).toBe(`${operation === 'remove' ? '' : '<replacement/>'}<outside/>`)
  })

  it('enforces expression boundaries when a custom resolver requires complete document validation', () => {
    const document = parse('<view>old</view>', { resolveScriptBoundary: (_source, _start, _tag, candidates) => candidates.closingTag })
    expect(() => edit(document, (handle) => {
      if (handle.node.kind === 'element') {
        handle.setAttribute('value', { expression: '1}}{{2' })
      }
    })).toThrow('single complete interpolation')
    expect(() => edit(document, (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText({ expression: '1}}</view><injected/><view>{{2' })
      }
    })).toThrow('single complete interpolation')
  })
})
