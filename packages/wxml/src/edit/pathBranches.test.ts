import { describe, expect, it } from 'vitest'
import { edit, parse } from '../index'

describe('path-based WXML navigation and source contracts', () => {
  it.each(['prepend', 'replaceWith'] as const)('projects %s fragments into the complete resolver document', (operation) => {
    const snippet = '<wxs module="m">var n = 1</wxs>'
    const expected = operation === 'prepend'
      ? `<root><target>${snippet}<keep/></target><tail/></root>`
      : `<root>${snippet}<tail/></root>`
    const inputs: string[] = []
    const original = parse('<root><target><keep/></target><tail/></root>', {
      resolveScriptBoundary(source, start, name, candidates) {
        inputs.push(source)
        expect(source).toBe(expected)
        expect(name).toBe('wxs')
        expect(source.slice(start).startsWith('var n = 1')).toBe(true)
        expect(source.slice(candidates.closingTag!.start, candidates.closingTag!.end)).toBe('</wxs>')
        return candidates.closingTag
      },
    })
    const next = edit(original, {
      Element(path) {
        if (path.isElement('target')) {
          path[operation](snippet)
        }
      },
    })
    expect(inputs.length).toBeGreaterThan(0)
    expect(next.source).toBe(expected)
  })

  it('projects raw-mode tag renames with current source and global candidates', () => {
    const expected = '<root><before/><wxs><child/></wxs><tail/></root>'
    const inputs: string[] = []
    const original = parse('<root><before/><view><child/></view><tail/></root>', {
      resolveScriptBoundary(source, start, _name, candidates) {
        inputs.push(source)
        expect(source).toBe(expected)
        expect(source.slice(start).startsWith('<child/>')).toBe(true)
        expect(source.slice(candidates.closingTag!.start, candidates.closingTag!.end)).toBe('</wxs>')
        return candidates.closingTag
      },
    })
    const next = edit(original, {
      Element(path) {
        if (path.isElement('view')) {
          path.rename('wxs')
          expect(path.node.children[0]?.kind).toBe('script')
        }
      },
    })
    expect(inputs.length).toBeGreaterThan(0)
    expect(next.source).toBe(expected)
  })

  it('keeps a failed raw-mode rename atomic and permits further edits', () => {
    const original = parse('<view><child/></view>', {
      resolveScriptBoundary() {
        throw new Error('boundary rejected')
      },
    })
    const next = edit(original, {
      Element(path) {
        if (path.isElement('view')) {
          const child = path.get('children')[0]!
          expect(() => path.rename('wxs')).toThrow('boundary rejected')
          expect(path.isElement('view')).toBe(true)
          expect(path.get('children')[0]).toBe(child)
          child.rename('kept')
        }
      },
    })
    expect(next.source).toBe('<view><kept/></view>')
    expect(original.source).toBe('<view><child/></view>')
  })

  it('removes all duplicate attributes and tolerates removing a missing attribute', () => {
    const next = edit(parse('<view a="first" a=second keep=\'raw\'/>'), {
      Element(path) {
        path.removeAttribute('missing')
        path.removeAttribute('a')
        expect(path.hasAttribute('a')).toBe(false)
        expect(path.getAttribute('a')).toBeUndefined()
        path.removeAttribute('a')
        expect(path.getAttribute('keep')?.quote).toBe('\'')
      },
    })
    expect(next.source).toBe('<view   keep=\'raw\'/>')
  })

  it('keeps repeated same-value setters, renames and text edits byte-identical', () => {
    const source = '<view a="same" bare>same</view>'
    const next = edit(parse(source), {
      Element(path) {
        path.rename('view')
        path.setAttribute('a', 'same')
        path.setAttribute('a', 'same')
        path.setBooleanAttribute('bare')
        path.setBooleanAttribute('bare')
      },
      Text(path) {
        path.replaceText('same')
        expect(path.isText()).toBe(true)
      },
    })
    expect(next.source).toBe(source)
  })

  it('renames source attributes without changing their quote or lexical value', () => {
    const source = '<view  old = \'&amp; {{value}}\' raw=bare bare />'
    const next = edit(parse(source), {
      Element(path) {
        path.renameAttribute('absent', 'unused')
        path.renameAttribute('old', 'old')
        path.renameAttribute('old', 'next')
        path.renameAttribute('raw', 'unquoted')
        path.renameAttribute('bare', 'flag')
        expect(path.getAttribute('next')).toEqual({ name: 'next', value: '&amp; {{value}}', quote: '\'' })
        expect(path.getAttribute('unquoted')?.value).toBe('bare')
        expect(path.getAttribute('flag')?.value).toBeUndefined()
      },
    })
    expect(next.source).toBe('<view  next = \'&amp; {{value}}\' unquoted=bare flag />')
  })

  it('rejects attribute rename collisions without losing either original value', () => {
    const source = '<view from=\'first\' to="second"/>'
    const next = edit(parse(source), {
      Element(path) {
        expect(() => path.renameAttribute('from', 'to')).toThrow(/existing/)
        expect(path.getAttribute('from')?.value).toBe('first')
        expect(path.getAttribute('to')?.value).toBe('second')
      },
    })
    expect(next.source).toBe(source)
  })

  it('handles navigation misses and rejects unsupported child selectors', () => {
    edit(parse('<root>text<leaf/></root>'), {
      enter(path) {
        expect(path.findParent(parent => parent.isElement('missing'))).toBeUndefined()
        expect(path.getSibling(-1)).toBeUndefined()
        expect(path.getSibling(100)).toBeUndefined()
        expect(() => path.get('attributes' as never)).toThrow(/children/)
        if (path.isText()) {
          expect(path.node.data).toBe('text')
          expect(path.get('children')).toEqual([])
          expect(path.hasAttribute('missing')).toBe(false)
          expect(path.getAttribute('missing')).toBeUndefined()
        }
        else {
          expect(path.isElement()).toBe(true)
        }
      },
    })
  })
})
