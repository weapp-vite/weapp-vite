import { describe, expect, it } from 'vitest'
import { compileDialect, createParser, edit } from '../core'

describe('path traversal context ownership', () => {
  it('follows the new scope children when a nested visitor changes its owner raw mode', () => {
    const parser = createParser(compileDialect({ id: 'opaque', syntax: 'xml', rawTags: ['opaque'] }))
    const original = parser.parse('<root><opaque><old/></opaque></root>')
    const visited: string[] = []
    const next = edit(original, {
      Element(owner) {
        if (!owner.isElement('opaque')) {
          return
        }
        owner.traverse({
          Script(path) {
            visited.push('script')
            owner.rename('panel')
            expect(path.removed).toBe(true)
          },
          Element(path) {
            visited.push(path.node.name)
            expect(path.originalNode).toBeUndefined()
            path.rename('updated')
          },
        })
      },
    })
    expect(visited).toEqual(['script', 'old'])
    expect(next.source).toBe('<root><panel><updated/></panel></root>')
    expect(original.source).toBe('<root><opaque><old/></opaque></root>')
  })

  it('rejects escaping raw content when renaming its owner and restores the previous logical state', () => {
    const parser = createParser(compileDialect({ id: 'opaque', syntax: 'xml', rawTags: ['opaque'] }))
    const source = '<opaque>"</view><outside/><view>"</opaque>'
    const original = parser.parse(source)
    expect(original.diagnostics).toEqual([])
    const next = edit(original, {
      Element(path) {
        expect(() => path.rename('view')).toThrow('preserve its element boundary')
        expect(path.node.name).toBe('opaque')
        path.setBooleanAttribute('preserved')
      },
    })
    expect(next.source).toBe('<opaque preserved>"</view><outside/><view>"</opaque>')
    expect(original.source).toBe(source)
  })

  it('rejects a resolver change that swallows another edited raw owner', () => {
    const parser = createParser(compileDialect({ id: 'opaque', syntax: 'xml', rawTags: ['opaque'] }), {
      resolveScriptBoundary(source, _start, _name, candidates) {
        if (source.includes('collapse')) {
          const start = source.lastIndexOf('</opaque>')
          return { start, end: start + '</opaque>'.length }
        }
        return candidates.closingTag
      },
    })
    const source = '<opaque id="first">const x=1;</opaque><opaque id="second">const y=2;</opaque><view/>'
    const original = parser.parse(source)
    expect(original.diagnostics).toEqual([])
    expect(() => edit(original, {
      Element(path) {
        if (path.isElement('view')) {
          path.setBooleanAttribute('collapse')
        }
      },
      Script(path) {
        if (path.node.data.includes('y=')) {
          path.replaceWith('const y=3;')
        }
      },
    })).toThrow('inside their original script owner')
    expect(original.source).toBe(source)
  })
})
