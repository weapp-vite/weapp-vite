import type { EditPath } from '../types'
import { describe, expect, it } from 'vitest'
import { edit, parse } from '../index'

describe('path editing traversal controls', () => {
  it.each(['global', 'typed'] as const)('skips descendants when the %s enter visitor returns false and still runs exit', (phase) => {
    const visits: string[] = []
    const next = edit(parse('<branch><hidden/></branch><outside/>'), {
      enter(path) {
        if (path.node.kind === 'element') {
          visits.push(`global:${path.node.name}`)
        }
        if (phase === 'global' && path.isElement('branch')) {
          return false
        }
      },
      Element: {
        enter(path) {
          visits.push(`typed:${path.node.name}`)
          if (phase === 'typed' && path.isElement('branch')) {
            return false
          }
        },
        exit(path) {
          visits.push(`exit:${path.node.name}`)
          path.setBooleanAttribute('visited')
        },
      },
    })
    expect(visits).toEqual(['global:branch', 'typed:branch', 'exit:branch', 'global:outside', 'typed:outside', 'exit:outside'])
    expect(next.source).toBe('<branch visited><hidden/></branch><outside visited/>')
  })

  it.each(['remove', 'stop'] as const)('does not call the typed visitor after the global enter visitor invokes %s', (operation) => {
    const visits: string[] = []
    const next = edit(parse('<first/><second/>'), {
      enter(path) {
        if (path.isElement('first')) {
          if (operation === 'remove') {
            path.remove()
          }
          else {
            path.rename('done')
            path.stop()
          }
        }
      },
      Element(path) {
        visits.push(path.node.name)
      },
    })
    expect(visits).toEqual(operation === 'remove' ? ['second'] : [])
    expect(next.source).toBe(operation === 'remove' ? '<second/>' : '<done/><second/>')
  })

  it('ends a nested traversal when its owner is replaced and visits the replacement in the outer traversal', () => {
    const nested: string[] = []
    const outer: string[] = []
    const next = edit(parse('<owner><first/><unvisited/></owner><outside/>'), {
      Element(path) {
        outer.push(path.node.name)
        if (path.isElement('owner')) {
          path.traverse({ Element(child) {
            nested.push(child.node.name)
            path.replaceWith('<replacement/>')
          } })
          expect(path.removed).toBe(true)
        }
      },
    })
    expect(nested).toEqual(['first'])
    expect(outer).toEqual(['owner', 'replacement', 'outside'])
    expect(next.source).toBe('<replacement/><outside/>')
  })

  it('discards a queued path that a later sibling removes before its revisit', () => {
    const visits: string[] = []
    let queued: EditPath | undefined
    const next = edit(parse('<root><queued/><eraser/><tail/></root>'), {
      Element(path) {
        visits.push(path.node.name)
        if (path.isElement('queued')) {
          queued = path
          path.requeue()
        }
        else if (path.isElement('eraser')) {
          queued!.remove()
        }
      },
    })
    expect(visits).toEqual(['root', 'queued', 'eraser', 'tail'])
    expect(queued!.removed).toBe(true)
    expect(next.source).toBe('<root><eraser/><tail/></root>')
  })

  it('deduplicates consecutive requeues and permits bounded revisits that change the current node', () => {
    const visits: Array<string | undefined> = []
    const state = { step: 0 }
    const next = edit(parse('<counter/>'), {
      Element(path, state) {
        visits.push(path.getAttribute('step')?.value)
        if (state.step < 3) {
          state.step++
          path.setAttribute('step', state.step)
          path.requeue()
          path.requeue()
        }
      },
    }, state)
    expect(visits).toEqual([undefined, '{{1}}', '{{2}}', '{{3}}'])
    expect(state.step).toBe(3)
    expect(next.source).toBe('<counter step="{{3}}"/>')
  })

  it.each([undefined, null, false, 1, 'visitor', [], () => {}])('rejects an invalid nested visitor map: %s', (visitors) => {
    const original = parse('<root><child/></root>')
    expect(() => edit(original, { Element(path) {
      path.traverse(visitors as never)
    } })).toThrow(TypeError)
    expect(original.source).toBe('<root><child/></root>')
  })

  it('rejects resolver mutations during fragment validation and restores the outer editing session afterward', () => {
    let retained: EditPath | undefined
    let attempts = 0
    const original = parse('<root/>', {
      resolveScriptBoundary(_source, _start, _name, candidates) {
        attempts++
        expect(() => retained!.setBooleanAttribute('reentrant')).toThrow(/active|editable/i)
        expect(() => retained!.stop()).toThrow(/active|editable/i)
        return candidates.closingTag
      },
    })
    const next = edit(original, { Element(path) {
      if (path.isElement('root')) {
        retained = path
        path.append('<wxs module="m">var n = 1</wxs>')
        path.setBooleanAttribute('after')
      }
    } })
    expect(attempts).toBeGreaterThanOrEqual(2)
    expect(next.source).toBe('<root after><wxs module="m">var n = 1</wxs></root>')
    expect(original.source).toBe('<root/>')
  })

  it('consumes a rejected asynchronous visitor result without mutating its input', async () => {
    const original = parse('<root/>')
    expect(() => edit(original, { enter: (() => Promise.reject(new Error('async visitor failed'))) as never }))
      .toThrow(/synchronous|Promise/)
    await Promise.resolve()
    expect(original.source).toBe('<root/>')
  })
})
