import type { Document, EditableNode, TemplateDocument } from './types'
import { describe, expect, it } from 'vitest'
import { compileDialect, createParser, edit as editCore, serialize, walk } from './core'
import { copyDocument } from './edit/document'
import { validateSnippets } from './edit/snippets'
import { edit, parse } from './index'

function rawDocument(source: string, rawTags: readonly string[] = ['opaque']) {
  const dialect = compileDialect({ id: 'decoupling-test', syntax: 'xml', rawTags })
  const parser = createParser(dialect)
  return { dialect, parser, document: parser.parse(source) }
}

function elementNames(document: TemplateDocument) {
  const names: string[] = []
  walk(document, { enter(node) {
    if (node.kind === 'element') {
      names.push(node.name)
    }
  } })
  return names
}

describe('platform-free parser contexts', () => {
  it('rejects invalid dialects, forged compiled objects and invalid parser options', () => {
    for (const definition of [null, [], 1, { id: '', syntax: 'xml', rawTags: [] }, { id: 1, syntax: 'xml', rawTags: [] }, { id: 'bad', syntax: 'html', rawTags: [] }, { id: 'bad', syntax: 'xml' }, { id: 'bad', syntax: 'xml', rawTags: [''] }, { id: 'bad', syntax: 'xml', rawTags: [1] }]) {
      expect(() => compileDialect(definition as never)).toThrow(TypeError)
    }
    const dialect = compileDialect({ id: 'valid', syntax: 'xml', rawTags: [] })
    expect(() => createParser({ ...dialect })).toThrow('compiled dialect')
    for (const options of [null, [], 1, { resolveScriptBoundary: true }]) {
      expect(() => createParser(dialect, options as never)).toThrow(TypeError)
    }
  })

  it('snapshots a resolver exactly once before binding the parser', () => {
    let reads = 0
    const sources: string[] = []
    const resolver = (source: string, _start: number, _tag: string, candidates: Parameters<NonNullable<Document['options']['resolveScriptBoundary']>>[3]) => {
      sources.push(source)
      return candidates.closingTag
    }
    const parser = createParser(compileDialect({ id: 'getter', syntax: 'xml', rawTags: ['opaque'] }), {
      get resolveScriptBoundary() {
        reads++
        return resolver
      },
    })
    const source = '<opaque>value</opaque>'
    parser.parse(source)
    parser.scan(source)
    parser.scanComments(source)
    expect(reads).toBe(1)
    expect(sources).toEqual([source, source])
    expect(Object.isFrozen(parser)).toBe(true)
  })

  it('keeps compiled dialect snapshots literal and independent', () => {
    const rawTags = ['x.y', 'opaque']
    const dialect = compileDialect({ id: 'literal', syntax: 'xml', rawTags })
    rawTags[0] = 'changed'
    const parser = createParser(dialect)
    expect(parser.parse('<x.y>value <view/></x.y>').children[0]).toMatchObject({ kind: 'element', name: 'x.y' })
    expect(parser.parse('<opaque>value <view/></opaque>').children[0]).toMatchObject({ kind: 'element', name: 'opaque' })
    const opaque = parser.parse('<opaque>value <view/></opaque>').children[0]
    expect(opaque?.kind === 'element' && opaque.children[0]).toMatchObject({ kind: 'script' })
    expect(dialect.rawTags).toEqual(['x.y', 'opaque'])
    expect(compileDialect({ id: 'empty', syntax: 'xml', rawTags: [] }).rawTags).toEqual([])
  })

  it('recognizes raw tags across ASCII initials and keeps literal names exact', () => {
    const initials = 'abcdefghijklmnopqrstuvwxyz_'
    const parser = createParser(compileDialect({ id: 'initials', syntax: 'xml', rawTags: Array.from(initials, initial => `${initial}raw`) }))
    for (const initial of `${initials}${initials.toUpperCase()}`) {
      const source = `<${initial}raw>const fake="<inner/>";</${initial}raw>`
      const document = parser.parse(source)
      expect(document.diagnostics).toEqual([])
      expect(document.children[0]?.kind === 'element' && document.children[0].children[0]?.kind).toBe('script')
      expect(parser.scan(source).tokens.filter(token => token.kind === 'script')).toHaveLength(1)
    }
    const literal = createParser(compileDialect({ id: 'literal-collision', syntax: 'xml', rawTags: ['x.y'] }))
    const document = literal.parse('<X.Y>const fake="<inner/>";</X.Y><xay><inner/></xay>')
    expect(document.diagnostics).toEqual([])
    expect(elementNames(document)).toEqual(['X.Y', 'xay', 'inner'])
    expect(Object.keys(literal.dialect)).toEqual(['id', 'syntax', 'rawTags'])
  })

  it('does not let parser contexts cross when parsing and editing documents', () => {
    const source = '<opaque>literal <view/></opaque>'
    const first = rawDocument(source, ['opaque'])
    const second = rawDocument(source, [])
    expect(first.document.children[0]?.kind === 'element' && first.document.children[0].children[0]?.kind).toBe('script')
    expect(second.document.children[0]?.kind === 'element' && second.document.children[0].children.find(child => child.kind === 'element')?.kind).toBe('element')

    const firstEdited = editCore(first.document, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'opaque') {
        handle.setAttribute('data-owner', 'first')
      }
    })
    const secondEdited = editCore(second.document, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.setAttribute('data-owner', 'second')
      }
    })
    expect(serialize(firstEdited)).toContain('data-owner="first"')
    expect(serialize(secondEdited)).toContain('data-owner="second"')
    expect(serialize(firstEdited)).toContain('<view/>')
    expect(serialize(secondEdited)).toContain('<view data-owner="second"/>')
  })

  it('reuses immutable root snapshots without retaining mutable option values', () => {
    const rawTags = ['opaque']
    const source = '<opaque><view/></opaque>'
    const first = parse(source, { syntax: 'xml', rawTags })
    const second = parse(source, { syntax: 'xml', rawTags })
    expect(first.options).toBe(second.options)
    rawTags.length = 0
    const third = parse(source, { syntax: 'xml', rawTags })
    expect(third.options.rawTags).toEqual([])
    expect(first.options.rawTags).toEqual(['opaque'])
    expect(first.options).not.toBe(third.options)
    expect(first.children[0]?.kind === 'element' && first.children[0].children[0]?.kind).toBe('script')
    expect(third.children[0]?.kind === 'element' && third.children[0].children[0]?.kind).toBe('element')
    const changed = edit(first, (handle) => {
      if (handle.node.kind === 'element') {
        handle.setBooleanAttribute('active')
      }
    })
    expect(serialize(changed)).toBe('<opaque active><view/></opaque>')
  })

  it('isolates cached root contexts for different resolvers', () => {
    const sources = [[], []] as [string[], string[]]
    const resolvers = sources.map(calls => (source: string, _start: number, _tag: string, candidates: Parameters<NonNullable<Document['options']['resolveScriptBoundary']>>[3]) => {
      calls.push(source)
      return candidates.closingTag
    })
    const source = '<wxs>value</wxs>'
    const first = parse(source, { resolveScriptBoundary: resolvers[0] })
    parse(source, { resolveScriptBoundary: resolvers[0] })
    const second = parse(source, { resolveScriptBoundary: resolvers[1] })
    edit(first, (handle) => {
      if (handle.node.kind === 'script') {
        handle.replaceWith('first')
      }
    })
    edit(second, (handle) => {
      if (handle.node.kind === 'script') {
        handle.replaceWith('second')
      }
    })
    expect(sources).toEqual([[source, source, '<wxs>first</wxs>'], [source, '<wxs>second</wxs>']])
  })

  it('supports no-op, lazy, structural and subsequent edits in one context', () => {
    const { document } = rawDocument('<opaque>old<child/></opaque>', [])
    const noOp = editCore(document, () => {})
    const lazy = editCore(noOp, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'opaque') {
        handle.setAttribute('title', 'new')
      }
    })
    const structural = editCore(lazy, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'child') {
        handle.replaceWith('<inserted/>')
      }
    })
    const second = editCore(structural, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'inserted') {
        handle.rename('final')
      }
    })
    expect(document.source).toBe('<opaque>old<child/></opaque>')
    expect(serialize(noOp)).toBe(document.source)
    expect(serialize(second)).toBe('<opaque title="new">old<final/></opaque>')
    expect(elementNames(second)).toEqual(['opaque', 'final'])
  })

  it('retains opaque ownership across lazy, structural and subsequent raw edits', () => {
    const body = 'const fake="</opaque><fake/>"; module.exports={};'
    const { document, parser } = rawDocument(`<root><opaque>${body}</opaque><tail/></root>`)
    const lazy = editCore(document, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'root') {
        handle.setAttribute('title', 'lazy')
      }
    })
    const structural = editCore(lazy, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'tail') {
        handle.insertBefore('<inserted/>')
      }
    })
    const raw = editCore(structural, (handle) => {
      if (handle.node.kind === 'script') {
        handle.replaceWith(`${body}const added="<more/>";`)
      }
    })
    expect(elementNames(raw)).toEqual(['root', 'opaque', 'inserted', 'tail'])
    expect(serialize(raw)).toBe(`<root title="lazy"><opaque>${body}const added="<more/>";</opaque><inserted/><tail/></root>`)
    expect(parser.parse(serialize(raw)).diagnostics).toEqual([])
    expect(document.source).toBe(`<root><opaque>${body}</opaque><tail/></root>`)
    expect(raw).not.toHaveProperty('platform')
    expect(raw).not.toHaveProperty('options')
  })

  it('expires all retained handles before complete-source resolver validation', () => {
    const sources: string[] = []
    const handles: EditableNode[] = []
    const parser = createParser(compileDialect({ id: 'resolver-lifecycle', syntax: 'xml', rawTags: ['opaque'] }), {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        for (const handle of handles) {
          expect(() => handle.remove()).toThrow('no longer active')
        }
        return candidates.closingTag
      },
    })
    const original = '<root><opaque>const fake="</opaque>";</opaque><tail/></root>'
    const document = parser.parse(original)
    const edited = editCore(document, (handle) => {
      handles.push(handle)
      if (handle.node.kind === 'element' && handle.node.name === 'tail') {
        handle.replaceWith('<next/>')
      }
    })
    const output = '<root><opaque>const fake="</opaque>";</opaque><next/></root>'
    expect(sources).toEqual([original, output])
    expect(serialize(edited)).toBe(output)
    for (const handle of handles) {
      expect(() => handle.insertAfter('<late/>')).toThrow('no longer active')
    }
  })

  it('rejects a detached core document while keeping legacy structural Documents usable', () => {
    const { document } = rawDocument('<opaque/>', [])
    expect(() => validateSnippets(document, [{ source: '<child/>', start: 0, end: 8 }])).not.toThrow()
    const copy = copyDocument(document)
    expect(copy).not.toBe(document)
    expect(serialize(editCore(copy, () => {}))).toBe(document.source)
    const detached = { ...document }
    expect(() => editCore(detached, () => {})).toThrow(/context|parser/i)
    expect(() => editCore(copyDocument(detached), () => {})).toThrow(/context|parser/i)
    expect(() => validateSnippets(detached, [{ source: '<child/>', start: 0, end: 8 }])).toThrow(/context|parser/i)
    expect(serialize(detached)).toBe(document.source)
    expect(elementNames(detached)).toEqual(['opaque'])

    const legacy = parse('<view title="old"/>')
    const restored: Document = { ...legacy }
    const edited = edit(restored, (handle) => {
      if (handle.node.kind === 'element') {
        handle.setAttribute('title', 'new')
      }
    })
    expect(serialize(edited)).toBe('<view title="new"/>')
  })

  it('keeps full-source resolver calls reentrant and validates edited source', () => {
    const calls: string[] = []
    const dialect = compileDialect({ id: 'resolver', syntax: 'xml', rawTags: ['wxs'] })
    const parserRef: { current?: ReturnType<typeof createParser> } = {}
    const parser = createParser(dialect, {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        calls.push(source)
        if (calls.length === 1) {
          expect(parserRef.current?.scan('<view/>').diagnostics).toEqual([])
        }
        return candidates.closingTag
      },
    })
    parserRef.current = parser
    const document = parser.parse('<view/><wxs>var value = 1;</wxs>')
    const edited = editCore(document, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'view') {
        handle.setAttribute('data-shift', 'yes')
      }
    })
    expect(calls).toEqual(['<view/><wxs>var value = 1;</wxs>', '<view data-shift="yes"/><wxs>var value = 1;</wxs>'])
    expect(serialize(edited)).toContain('<wxs>var value = 1;</wxs>')
  })
})
