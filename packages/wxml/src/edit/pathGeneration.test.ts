import { describe, expect, it } from 'vitest'
import { compileDialect, createParser, edit as editCore } from '../core'
import { edit, parse } from '../index'

describe('path structural generation ownership', () => {
  it('bounds generated children that keep appending through an original parent', () => {
    let visits = 0
    expect(() => edit(parse('<root><item/></root>'), {
      Element(path) {
        if (path.isElement('item')) {
          if (++visits > 1100) {
            throw new Error('Regression insurance: generated child traversal did not terminate.')
          }
          path.parentPath!.append('<item/>')
        }
      },
    })).toThrow('structural generation limit')
    expect(visits).toBeLessThanOrEqual(1100)
  })

  it('preserves outer execution ancestry while a nested traversal edits an original ancestor', () => {
    let visits = 0
    expect(() => edit(parse('<root><marker/><item/></root>'), {
      Element(path) {
        if (path.isElement('item')) {
          if (++visits > 1100) {
            throw new Error('Regression insurance: nested generation traversal did not terminate.')
          }
          const root = path.parentPath!
          root.traverse({
            Element(marker) {
              if (marker.isElement('marker')) {
                root.append('<item/>')
              }
            },
          })
        }
      },
    })).toThrow('structural generation limit')
    expect(visits).toBeLessThanOrEqual(1100)
  })

  it('preserves generated owner ancestry after raw mode rebuilds its descendants', () => {
    const parser = createParser(compileDialect({ id: 'opaque', syntax: 'xml', rawTags: ['opaque'] }))
    let visits = 0
    expect(() => editCore(parser.parse('<root><opaque>"seed"</opaque></root>'), {
      Element(path) {
        if (path.isElement('opaque')) {
          path.rename('panel')
        }
      },
      Text(path) {
        if (++visits > 1100) {
          throw new Error('Regression insurance: rebuilt generation traversal did not terminate.')
        }
        path.findParent(parent => parent.isElement('root'))!.append('<opaque>"seed"</opaque>')
      },
    })).toThrow('structural generation limit')
    expect(visits).toBeLessThanOrEqual(1100)
  })

  it('allows more than 1024 independent original children to append new siblings', () => {
    const original = parse(`<root>${'<seed/>'.repeat(1100)}</root>`)
    let seeds = 0
    let additions = 0
    const next = edit(original, {
      Element(path) {
        if (path.isElement('seed')) {
          seeds++
          expect(path.originalNode).toBeDefined()
          path.parentPath!.append('<done/>')
        }
        else if (path.isElement('done')) {
          additions++
          expect(path.originalNode).toBeUndefined()
        }
      },
    })
    expect(seeds).toBe(1100)
    expect(additions).toBe(1100)
    const root = next.children[0]!
    expect(root.kind === 'element' && root.children.length).toBe(2200)
    expect(original.source).toBe(`<root>${'<seed/>'.repeat(1100)}</root>`)
  })
})
