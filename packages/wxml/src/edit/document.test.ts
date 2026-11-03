import type { EditableNode } from '../types'
import { describe, expect, it } from 'vitest'
import { parse } from '../parser'
import { serialize } from '../serialize'
import { walk } from '../walk'
import { edit } from './index'

describe('edited WXML document materialization', () => {
  it('keeps repeated canonical output identical before and after public AST materialization', () => {
    const next = edit(parse('<view a=\'first\' a=second><text>old</text></view>'), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.rename('panel')
        handle.setAttribute('a', 'new')
        handle.setBooleanAttribute('bare')
      }
      if (handle.node.kind === 'text') {
        handle.replaceText('new & <text>')
      }
    })
    const expected = '<panel a="new" bare><text>new &amp; &lt;text&gt;</text></panel>'
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
    const tokens = next.tokens
    expect(tokens[0]?.start).toBe(0)
    expect(next.tokens).toBe(tokens)
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
    const children = next.children
    expect(next.children).toBe(children)
    expect(children).toEqual(parse(next.source).children)
    expect(edit(next, () => {}).source).toBe(next.source)
  })

  it('returns a complete independent document when a no-op edit follows a lazy edit', () => {
    const original = parse('<view title="old"><text>old</text></view>')
    const first = edit(original, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.setAttribute('title', 'new')
      }
      if (handle.node.kind === 'text') {
        handle.replaceText('new & value')
      }
    })
    const expected = '<view title="new"><text>new &amp; value</text></view>'
    expect(serialize(first, { mode: 'canonical' })).toBe(expected)
    const unchanged = edit(first, () => {})
    expect(unchanged).not.toBe(first)
    expect(unchanged.source).toBe(expected)
    expect(unchanged.children).toBe(first.children)
    expect(unchanged.tokens).toBe(first.tokens)
    expect(unchanged.options).toBe(first.options)
    expect(unchanged.diagnostics).toEqual([])
    const names: string[] = []
    walk(unchanged, { enter(node) {
      if (node.kind === 'element') {
        names.push(node.name)
      }
    } })
    expect(names).toEqual(['view', 'text'])
    expect(serialize(unchanged)).toBe(expected)
    const second = edit(unchanged, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'text') {
        handle.rename('label')
      }
    })
    expect(serialize(second, { mode: 'canonical' })).toBe(expected.replaceAll('text>', 'label>'))
    expect(original.source).toBe('<view title="old"><text>old</text></view>')
  })

  it('serializes all public document fields to JSON without enumerating private lazy state', () => {
    const next = edit(parse('<view value=\'old\'>old</view>'), (handle) => {
      if (handle.node.kind === 'element') {
        handle.setAttribute('value', 'new')
      }
      else if (handle.node.kind === 'text') {
        handle.replaceText('new')
      }
    })
    const fields = ['source', 'platform', 'syntax', 'diagnostics', 'options', 'children', 'tokens']
    expect(Object.keys(next).every(field => fields.includes(field))).toBe(true)
    const json: unknown = JSON.parse(JSON.stringify(next))
    expect(json).toEqual(JSON.parse(JSON.stringify(parse(next.source, next.options))))
    expect(Object.keys(json as object).sort()).toEqual(fields.sort())
    expect(serialize(next, { mode: 'canonical' })).toBe('<view value="new">new</view>')
    expect(next.children).toBe(next.children)
    expect(next.tokens).toBe(next.tokens)
  })

  it('rejects malformed newly encoded expressions before publishing a document', () => {
    expect(() => edit(parse('<view/>'), handle => handle.setAttribute('value', { expression: '"unclosed' })))
      .toThrow('Invalid WXML')
    expect(() => edit(parse('<text>old</text>'), (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText({ expression: '"unclosed' })
      }
    })).toThrow('Invalid WXML')
  })

  it.each(['legacy', 'xml'] as const)('keeps literal and scalar overlays identical to materialized %s syntax', (syntax) => {
    const next = edit(parse('<view keep=\'raw\' duplicate=first duplicate=second empty="" removed="old">old</view>', { syntax }), (handle) => {
      if (handle.node.kind === 'element') {
        handle.setAttribute('duplicate', String.raw`&amp; {{literal}} " ' <tag> \\path`)
        handle.setAttribute('count', 1e30)
        handle.setAttribute('enabled', false)
        handle.setBooleanAttribute('empty')
        handle.removeAttribute('removed')
        handle.setAttribute('added', '')
      }
      else if (handle.node.kind === 'text') {
        handle.replaceText(String.raw`&amp; {{literal}} " ' <tag> \\path`)
      }
    })
    const canonical = serialize(next, { mode: 'canonical' })
    expect(canonical).toContain('&amp;amp;')
    expect(canonical).toContain('{{\'{\'}}{{\'{\'}}literal}}')
    expect(canonical).toContain(' empty count="{{1e+30}}" enabled="{{false}}" added=""')
    expect(canonical.match(/duplicate=/g)).toHaveLength(1)
    expect(canonical).not.toContain('removed=')
    expect(serialize(parse(next.source, { syntax }), { mode: 'canonical' })).toBe(canonical)
    expect(next.children).toEqual(parse(next.source, { syntax }).children)
    expect(serialize(next, { mode: 'canonical' })).toBe(canonical)
  })

  it('validates only the final expression values after subsequent controlled setters', () => {
    const next = edit(parse('<view literal="old" bare="old" removed="old"/>'), (handle) => {
      handle.setAttribute('literal', { expression: '"unclosed' })
      handle.setAttribute('bare', { expression: '"unclosed' })
      handle.setAttribute('removed', { expression: '"unclosed' })
      handle.setAttribute('literal', 'safe')
      handle.setBooleanAttribute('bare')
      handle.removeAttribute('removed')
    })
    expect(serialize(next, { mode: 'canonical' })).toBe('<view literal="safe" bare />')
    expect(next.children).toEqual(parse(next.source).children)
    expect(() => edit(parse('<view/>'), (handle) => {
      handle.setAttribute('value', 'safe')
      handle.setAttribute('value', { expression: '"unclosed' })
    })).toThrow('Invalid WXML')
  })

  it('keeps lazy committed state immutable when setter closures escape the session', () => {
    let setAttribute: EditableNode['setAttribute'] | undefined
    let setBooleanAttribute: EditableNode['setBooleanAttribute'] | undefined
    let removeAttribute: EditableNode['removeAttribute'] | undefined
    let rename: EditableNode['rename'] | undefined
    let replaceText: EditableNode['replaceText'] | undefined
    const next = edit(parse('<view title="old"><text>old</text></view>'), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        setAttribute = handle.setAttribute
        setBooleanAttribute = handle.setBooleanAttribute
        removeAttribute = handle.removeAttribute
        rename = handle.rename
        setAttribute('title', 'committed')
        setBooleanAttribute('enabled')
      }
      else if (handle.node.kind === 'text') {
        replaceText = handle.replaceText
        replaceText('committed & {{literal}}')
      }
    })
    expect(() => setAttribute!('title', 'late')).toThrow('no longer active')
    expect(() => setBooleanAttribute!('late')).toThrow('no longer active')
    expect(() => removeAttribute!('enabled')).toThrow('no longer active')
    expect(() => rename!('late')).toThrow('no longer active')
    expect(() => replaceText!('late')).toThrow('no longer active')
    const expected = '<view title="committed" enabled><text>committed &amp; {{\'{\'}}{{\'{\'}}literal}}</text></view>'
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
    expect(next.source).toBe(expected)
    expect(next.children).toEqual(parse(expected).children)
    expect(serialize(next, { mode: 'canonical' })).toBe(expected)
  })

  it('reparses raw-tag renames, script replacements, empty text and structural changes', () => {
    const ordinaryToRaw = edit(parse('<view><text/></view>'), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.rename('wxs')
      }
    })
    const raw = ordinaryToRaw.children[0]
    expect(raw?.kind === 'element' && raw.children[0]?.kind).toBe('script')
    const rawToOrdinary = edit(ordinaryToRaw, (handle) => {
      if (handle.node.kind === 'element') {
        handle.rename('view')
      }
    })
    const ordinary = rawToOrdinary.children[0]
    expect(ordinary?.kind === 'element' && ordinary.children[0]?.kind).toBe('element')
    const scriptEdit = edit(parse('<wxs module="m">var old = 1</wxs>'), (handle) => {
      if (handle.node.kind === 'script') {
        handle.replaceWith('var updated = 2')
      }
    })
    expect(serialize(scriptEdit, { mode: 'canonical' })).toBe('<wxs module="m">var updated = 2</wxs>')
    const empty = edit(parse('<text>old</text>'), (handle) => {
      if (handle.node.kind === 'text') {
        handle.replaceText('')
      }
    })
    expect(empty.source).toBe('<text></text>')
    expect(empty.tokens).toHaveLength(2)
  })

  it('revalidates custom script boundary resolvers against the complete edited source', () => {
    const sources: string[] = []
    const options = {
      resolveScriptBoundary(source: string, _start: number, _tag: string, candidates: { closingTag?: { start: number, end: number } }) {
        sources.push(source)
        return candidates.closingTag
      },
    }
    const source = '<view/><wxs module="m">var value = 1</wxs>'
    const next = edit(parse(source, options), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.setAttribute('long', 'shift the script source ranges')
      }
    })
    expect(sources).toEqual([source, next.source])
    expect(serialize(next, { mode: 'canonical' })).toContain('<wxs module="m">var value = 1</wxs>')
    expect(next.tokens).toEqual(parse(next.source, options).tokens)
  })
})
