import type { EditableNode, ScriptBoundaryCandidates } from '../types'
import { describe, expect, it } from 'vitest'
import { parse } from '../parser'
import { serialize } from '../serialize'
import { edit } from './index'

describe('complete-context script resolvers in structural snippets', () => {
  const script = '<wxs module="m">var ok = a<b; var fake = "</wxs>";</wxs>'

  it.each([
    ['insertBefore', `<root>${script}<anchor/></root>`],
    ['insertAfter', `<root><anchor/>${script}</root>`],
    ['prepend', `<root><anchor>${script}</anchor></root>`],
    ['append', `<root><anchor>${script}</anchor></root>`],
    ['replaceWith', `<root>${script}</root>`],
  ] as const)('validates %s with only the final complete source', (operation, expected) => {
    const sources: string[] = []
    const next = edit(parse('<root><anchor/></root>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        return source === expected ? candidates.closingTag : undefined
      },
    }), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'anchor') {
        handle[operation](script)
      }
    })
    expect(next.source).toBe(expected)
    expect(sources).toEqual([expected])
    expect(next.diagnostics).toEqual([])
  })

  it('maps nested and duplicate snippets after preceding source edits without local resolver calls', () => {
    const sources: string[] = []
    const snippet = '<wrapper><wxs module="m">var n = 1;</wxs><inner/></wrapper>'
    const expected = `<root marker="shift ranges"><first/>${snippet}<last/>${snippet}</root>`
    const next = edit(parse('<root><first/><last/></root>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        return source.startsWith('<root marker="shift ranges">') ? candidates.closingTag : undefined
      },
    }), (handle) => {
      if (handle.node.kind !== 'element') {
        return
      }
      if (handle.node.name === 'root') {
        handle.setAttribute('marker', 'shift ranges')
      }
      else {
        handle.insertAfter(snippet)
      }
    })
    expect(next.source).toBe(expected)
    expect(sources).toEqual([expected, expected])
    expect(serialize(next, { mode: 'canonical' })).toContain(snippet.replace('<inner/>', '<inner />'))
  })

  it('reuses the complete resolver decision for an ambiguous comment closing', () => {
    const sources: string[] = []
    const snippet = '<wxs module="m">module.exports = 1 // tail</wxs>'
    const expected = `<root><anchor/>${snippet}</root>`
    const next = edit(parse('<root><anchor/></root>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        return source === expected ? candidates.closingTag ?? candidates.commentClosings?.at(-1) : undefined
      },
    }), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'anchor') {
        handle.insertAfter(snippet)
      }
    })
    expect(next.source).toBe(expected)
    expect(sources).toEqual([expected])
    const root = next.children[0]
    const raw = root?.kind === 'element' ? root.children[1] : undefined
    expect(raw?.kind === 'element' && raw.children[0]).toMatchObject({ kind: 'script', data: 'module.exports = 1 // tail' })
  })

  it.each([
    '</root><outside/><root>',
    '</root><wxs>var escaped = 1;</wxs><root>',
  ])('rejects independently unbalanced fragments even when the final document balances: %s', (snippet) => {
    const sources: string[] = []
    const expected = `<root><anchor/>${snippet}</root>`
    expect(() => edit(parse('<root><anchor/></root>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        return candidates.closingTag
      },
    }), (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'anchor') {
        handle.insertAfter(snippet)
      }
    })).toThrow('Invalid WXML')
    expect(sources).toEqual(snippet.includes('<wxs>') ? [expected] : [])
  })

  it('rejects a raw snippet that borrows a closing tag outside its own source range', () => {
    const source = '<root><anchor/><wxs module="existing">var old = 1;</wxs></root>'
    const snippet = '<wxs module="inserted">var added = 1;'
    const expected = source.replace('<anchor/>', snippet)
    const sources: string[] = []
    const options = {
      resolveScriptBoundary(input: string, _start: number, _tag: string, candidates: ScriptBoundaryCandidates) {
        sources.push(input)
        return candidates.closingTag
      },
    }
    const document = parse(source, options)
    sources.length = 0
    expect(() => edit(document, (handle) => {
      if (handle.node.kind === 'element' && handle.node.name === 'anchor') {
        handle.replaceWith(snippet)
      }
    })).toThrow('Invalid WXML')
    expect(sources).toEqual([expected])
  })

  it.each(['remove', 'replaceWith'] as const)('cancels covered deferred fragments after ancestor %s', (operation) => {
    let root: EditableNode | undefined
    let retained: EditableNode | undefined
    const sources: string[] = []
    const next = edit(parse('<root><first/><last/></root><outside/>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        return candidates.closingTag
      },
    }), (handle) => {
      if (handle.node.kind !== 'element') {
        return
      }
      if (handle.node.name === 'root') {
        root = handle
      }
      if (handle.node.name === 'first') {
        retained = handle
        handle.insertAfter('</root><wxs>bad</wxs><root>')
      }
      if (handle.node.name === 'last') {
        if (operation === 'remove') {
          root!.remove()
        }
        else {
          root!.replaceWith('<replacement/>')
        }
        expect(() => retained!.insertAfter('<late/>')).toThrow('no longer active')
      }
    })
    expect(next.source).toBe(`${operation === 'remove' ? '' : '<replacement/>'}<outside/>`)
    expect(sources).toEqual([])
  })

  it('rejects retained structural setter closures after the complete document is committed', () => {
    let insertAfter: EditableNode['insertAfter'] | undefined
    const sources: string[] = []
    const next = edit(parse('<anchor/>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        return candidates.closingTag
      },
    }), (handle) => {
      insertAfter = handle.insertAfter
      insertAfter(script)
    })
    expect(() => insertAfter!('<late/>')).toThrow('no longer active')
    expect(next.source).toBe(`<anchor/>${script}`)
    expect(sources).toEqual([next.source])
  })

  it('closes retained setters before invoking the complete-source resolver during validation', () => {
    let setAttribute: EditableNode['setAttribute'] | undefined
    const sources: string[] = []
    const next = edit(parse('<anchor/>', {
      resolveScriptBoundary(source, _start, _tag, candidates) {
        sources.push(source)
        expect(() => setAttribute!('late', 'discarded')).toThrow('no longer active')
        return candidates.closingTag
      },
    }), (handle) => {
      setAttribute = handle.setAttribute
      handle.insertAfter(script)
    })
    expect(next.source).toBe(`<anchor/>${script}`)
    expect(sources).toEqual([next.source])
  })

  it.each(['insertBefore', 'insertAfter', 'prepend', 'append'] as const)('keeps empty %s a no-op for self-closing tags with a custom resolver', (operation) => {
    for (const source of ['<view/>', '<wxs module="m"/>']) {
      const sources: string[] = []
      const next = edit(parse(source, {
        resolveScriptBoundary(input, _start, _tag, candidates) {
          sources.push(input)
          return candidates.closingTag
        },
      }), handle => handle[operation](''))
      expect(next.source).toBe(source)
      expect(sources).toEqual([])
      expect(next.children[0]?.kind === 'element' && next.children[0].selfClosing).toBe(true)
    }
  })

  it.each([
    ['<root><view/></root>', 'element', '<root></root>'],
    ['<root>old</root>', 'text', '<root></root>'],
    ['<wxs>var old = 1;</wxs>', 'script', '<wxs></wxs>'],
  ] as const)('keeps empty replacement meaningful for %s', (source, kind, expected) => {
    const document = parse(source, { resolveScriptBoundary: (_input, _start, _tag, candidates) => candidates.closingTag })
    const next = edit(document, (handle) => {
      if (handle.node.kind === kind && (handle.node.kind !== 'element' || handle.node.name === 'view')) {
        handle.replaceWith('')
      }
    })
    expect(next.source).toBe(expected)
    expect(next.diagnostics).toEqual([])
  })
})
