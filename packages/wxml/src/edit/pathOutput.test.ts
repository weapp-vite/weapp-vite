import { describe, expect, it } from 'vitest'
import { compileDialect, createParser, edit as editCore } from '../core'
import { edit, parse, serialize } from '../index'

describe('path-based WXML output contracts', () => {
  it('preserves untouched bytes and uses the current attribute state for rename', () => {
    const source = '\uFEFF<!-- keep -->\r\n<view  title=\'old\' raw=bare><text >old</text ></view >\r\n'
    const original = parse(source)
    const next = edit(original, {
      Element(path) {
        if (path.isElement('view')) {
          path.setAttribute('title', 'new')
          path.renameAttribute('title', 'label')
          expect(path.hasAttribute('title')).toBe(false)
          expect(path.getAttribute('label')?.value).toBe('new')
        }
      },
      Text(path) {
        if (path.node.kind === 'text' && path.node.data === 'old') {
          path.replaceText('new & <value>')
          expect(path.node.data).toBe('new &amp; &lt;value&gt;')
        }
      },
    })
    expect(next.source).toContain('raw=bare><text >new &amp; &lt;value&gt;</text ></view >\r\n')
    expect(next.source.startsWith('\uFEFF<!-- keep -->\r\n')).toBe(true)
    expect(original.source).toBe(source)
    expect(edit(original, {}).source).toBe(source)
  })

  it('runs non-element visitors and publishes accurate committed ranges', () => {
    const visited: string[] = []
    const next = edit(parse('<!--note--><![CDATA[raw]]><view>text</view>'), {
      Comment(path) { visited.push(path.node.kind) },
      Cdata(path) { visited.push(path.node.kind) },
      Text(path) {
        visited.push(path.node.kind)
        path.replaceText('a much longer value')
      },
    })
    expect(visited).toEqual(['comment', 'cdata', 'text'])
    for (const token of next.tokens) {
      if (token.kind === 'tag') {
        expect(next.source.slice(token.nameStart, token.nameEnd)).toBe(token.name)
      }
    }
    expect(serialize(next, { mode: 'canonical' })).toBe(serialize(parse(next.source), { mode: 'canonical' }))
  })

  it('inherits a pure core parser dialect when editing new fragments', () => {
    const parser = createParser(compileDialect({ id: 'custom', syntax: 'xml', rawTags: ['opaque'] }))
    const document = parser.parse('<root/>')
    const next = editCore(document, {
      Element(path) {
        if (path.isElement('root')) {
          path.append('<opaque>const x = "<not-markup>"</opaque>')
        }
      },
    })
    expect(next.source).toBe('<root><opaque>const x = "<not-markup>"</opaque></root>')
    expect(next.children).toEqual(parser.parse(next.source).children)
  })

  it('keeps script edits inside their original raw owner', () => {
    expect(() => edit(parse('<wxs module="m">var x = 1</wxs>'), {
      Script(path) { path.replaceWith('</wxs><view/><wxs>') },
    })).toThrow()
    const next = edit(parse('<wxs module="m">var x = 1</wxs>'), {
      Script(path) { path.replaceWith('var x = 2') },
    })
    expect(next.source).toBe('<wxs module="m">var x = 2</wxs>')
  })

  it('resolves inserted script boundaries against the complete host source', () => {
    const seen: string[] = []
    const document = parse('<root><view/></root>', {
      rawTags: ['opaque'],
      resolveScriptBoundary(source, _start, _name, candidates) {
        seen.push(source)
        expect(source.startsWith('<root>')).toBe(true)
        expect(source.endsWith('</root>')).toBe(true)
        return candidates.closingTag
      },
    })
    const next = edit(document, {
      Element(path) {
        if (path.isElement('view')) {
          path.append('<opaque>const x = "<not-markup>"</opaque>')
        }
      },
    })
    expect(seen.length).toBeGreaterThan(0)
    expect(seen).toContain(next.source)
    expect(next.source).toBe('<root><view><opaque>const x = "<not-markup>"</opaque></view></root>')
  })

  it('rejects asynchronous visitors and keeps the input intact on failure', () => {
    const original = parse('<view/>')
    expect(() => edit(original, { Element: (async () => {}) as never })).toThrow(/synchronous|Promise/)
    expect(() => edit(original, { Element(path) {
      path.rename('changed')
      throw new Error('visitor failed')
    } })).toThrow('visitor failed')
    expect(original.source).toBe('<view/>')
  })

  it('keeps the legacy callback snapshot and insertion visitation contracts', () => {
    const names: string[] = []
    const next = edit(parse('<view/>'), (handle) => {
      if (handle.node.kind === 'element') {
        names.push(handle.node.name)
        handle.rename('panel')
        expect(handle.node.name).toBe('view')
        handle.append('<text/>')
      }
    })
    expect(names).toEqual(['view'])
    expect(next.source).toBe('<panel><text/></panel>')
  })
})
