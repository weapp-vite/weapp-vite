import type { EditPath } from '../types'
import { describe, expect, it } from 'vitest'
import { edit, parse } from '../index'

describe('path-based WXML validation and lifecycle', () => {
  it('rejects invalid visitor maps before invoking a valid callback', () => {
    const original = parse('<view/>')
    for (const invalid of [null, [], 1, 'visitor', { Element: 1 }, { Element: { enter: 1 } }, { Element: { leave() {} } }, { Elememt() {} }]) {
      expect(() => edit(original, invalid as never)).toThrow(TypeError)
    }
    const calls: string[] = []
    expect(() => edit(original, {
      enter() { calls.push('entered') },
      Text: { exit: 'invalid' },
    } as never)).toThrow(TypeError)
    expect(calls).toEqual([])
    expect(original.source).toBe('<view/>')
  })

  it('rejects promises in global, exit and nested visitors and expires escaped paths', () => {
    const original = parse('<view><text/></view>')
    let retained: EditPath | undefined
    expect(() => edit(original, {
      enter: (async (path: EditPath) => { retained = path }) as never,
    })).toThrow(/synchronous|Promise/)
    expect(() => retained!.rename('late')).toThrow(/active|completed|editable/i)
    expect(() => edit(original, { Element: { exit: (async () => {}) as never } }))
      .toThrow(/synchronous|Promise/)
    expect(() => edit(original, {
      Element(path) {
        path.traverse({ enter: (async () => {}) as never })
      },
    })).toThrow(/synchronous|Promise/)
    expect(original.source).toBe('<view><text/></view>')
  })

  it('exposes read-only semantic nodes, attributes and navigation snapshots', () => {
    const next = edit(parse('<view title="original"><text/></view>'), {
      Element(path) {
        if (!path.isElement('view')) {
          return
        }
        const current = path.node
        const attributes = current.attributes
        const children = path.get('children')
        expect(() => {
          (current as { name: string }).name = 'forged'
        }).toThrow(TypeError)
        expect(() => {
          (attributes[0] as { value: string }).value = 'forged'
        }).toThrow(TypeError)
        expect(Object.isFrozen(attributes)).toBe(true)
        expect(Object.isFrozen(current.children)).toBe(true)
        expect(Object.isFrozen(children)).toBe(true)
        path.setAttribute('title', 'updated')
        path.append('<button/>')
        expect(current.attributes[0]?.value).toBe('updated')
        expect(current.children).toHaveLength(2)
        expect(attributes[0]?.value).toBe('original')
        expect(children).toHaveLength(1)
      },
    })
    expect(next.source).toBe('<view title="updated"><text/><button/></view>')
  })

  it('keeps empty insertions as no-ops and allows empty replacements to remove a node', () => {
    const original = parse('<root><empty/><keep/></root>')
    const next = edit(original, {
      Element(path) {
        if (path.isElement('empty')) {
          expect(path.insertBefore('')).toEqual([])
          expect(path.insertAfter('')).toEqual([])
          expect(path.prepend('')).toEqual([])
          expect(path.append('')).toEqual([])
          expect(path.node.selfClosing).toBe(true)
          expect(path.replaceWith('')).toEqual([])
          expect(path.removed).toBe(true)
        }
      },
    })
    expect(next.source).toBe('<root><keep/></root>')
    expect(original.source).toBe('<root><empty/><keep/></root>')
  })

  it('rejects invalid names, scalar values, text operations and snippets', () => {
    const element = parse('<view title="unchanged"/>')
    for (const mutate of [
      (path: EditPath) => path.rename('invalid name'),
      (path: EditPath) => path.setAttribute('invalid name', 'value'),
      (path: EditPath) => path.renameAttribute('title', 'invalid name'),
      (path: EditPath) => path.removeAttribute('invalid name'),
      (path: EditPath) => path.setAttribute('value', Number.NaN),
      (path: EditPath) => path.setAttribute('value', Number.POSITIVE_INFINITY),
      (path: EditPath) => path.setAttribute('value', undefined as never),
      (path: EditPath) => path.setAttribute('value', { expression: '' }),
      (path: EditPath) => path.replaceText('invalid target'),
      (path: EditPath) => path.replaceWith('<unclosed>'),
      (path: EditPath) => path.append(null as never),
    ]) {
      expect(() => edit(element, { Element: mutate })).toThrow()
    }
    const text = parse('text')
    expect(() => edit(text, { Text(path) {
      path.setAttribute('a', 'value')
    } })).toThrow(/element/)
    expect(() => edit(text, { Text(path) {
      path.append('<view/>')
    } })).toThrow(/element/)
    expect(() => edit(text, { Text(path) {
      path.replaceText(null as never)
    } })).toThrow()
    expect(element.source).toBe('<view title="unchanged"/>')
    expect(text.source).toBe('text')
  })

  it('rejects skip on a different path and still runs exit when the current path skips', () => {
    expect(() => edit(parse('<root><child/></root>'), {
      Element(path) {
        if (path.isElement('root')) {
          path.get('children')[0]!.skip()
        }
      },
    })).toThrow(/current|frame|visitor/)
    const visited: string[] = []
    edit(parse('<root><child/></root>'), {
      Element: {
        enter(path) {
          if (path.node.kind === 'element') {
            visited.push(`enter:${path.node.name}`)
          }
          path.skip()
        },
        exit(path) {
          if (path.node.kind === 'element') {
            visited.push(`exit:${path.node.name}`)
          }
        },
      },
    })
    expect(visited).toEqual(['enter:root', 'exit:root'])
  })

  it('makes identical replacements a no-op so automatic traversal terminates', () => {
    let visits = 0
    const next = edit(parse('<wxs module="m">var x = 1</wxs>'), {
      Script(path) {
        visits++
        const [replacement] = path.replaceWith('var x = 2')
        expect(replacement?.node.kind).toBe('script')
      },
    })
    expect(visits).toBe(2)
    expect(next.source).toBe('<wxs module="m">var x = 2</wxs>')
  })

  it('bounds replacement generations instead of hanging on an alternating transform', () => {
    expect(() => edit(parse('<first/>'), {
      Element(path) {
        path.replaceWith(path.isElement('first') ? '<second/>' : '<first/>')
      },
    })).toThrow(/limit|loop|generation|terminate/i)
  })

  it('expires setters, structure operations and traversal controls after the session', () => {
    let retained: EditPath | undefined
    edit(parse('<view/>'), { Element(path) {
      retained = path
    } })
    for (const mutate of [
      () => retained!.setAttribute('a', 'late'),
      () => retained!.setBooleanAttribute('a'),
      () => retained!.removeAttribute('a'),
      () => retained!.renameAttribute('a', 'b'),
      () => retained!.rename('late'),
      () => retained!.remove(),
      () => retained!.replaceWith('<late/>'),
      () => retained!.insertBefore('<late/>'),
      () => retained!.insertAfter('<late/>'),
      () => retained!.prepend('<late/>'),
      () => retained!.append('<late/>'),
      () => retained!.traverse({}),
      () => retained!.skip(),
      () => retained!.stop(),
      () => retained!.requeue(),
    ]) {
      expect(mutate).toThrow(/active|completed|editable/i)
    }
  })

  it('visits new children inserted during exit without rerunning the parent exit', () => {
    const visits: string[] = []
    const next = edit(parse('<root/>'), {
      Element: {
        enter(path) {
          if (path.node.kind === 'element') {
            visits.push(`enter:${path.node.name}`)
          }
          if (path.isElement('legacy')) {
            path.rename('button')
          }
        },
        exit(path) {
          if (path.node.kind === 'element') {
            visits.push(`exit:${path.node.name}`)
          }
          if (path.isElement('root')) {
            path.append('<legacy/>')
          }
        },
      },
    })
    expect(visits).toEqual(['enter:root', 'exit:root', 'enter:legacy', 'exit:button'])
    expect(next.source).toBe('<root><button/></root>')
  })

  it('projects non-element insertion positions into the complete resolver source', () => {
    const expected = '<root>lead<wxs module="m">var n = 1</wxs><leaf/></root>'
    const inputs: string[] = []
    const original = parse('<root>lead<leaf/></root>', {
      resolveScriptBoundary(input, start, _tag, candidates) {
        inputs.push(input)
        expect(input).toBe(expected)
        expect(input.slice(start).startsWith('var n = 1')).toBe(true)
        expect(input.slice(candidates.closingTag!.start, candidates.closingTag!.end)).toBe('</wxs>')
        return candidates.closingTag
      },
    })
    const next = edit(original, {
      Text(path) {
        if (path.node.data === 'lead') {
          path.insertAfter('<wxs module="m">var n = 1</wxs>')
        }
      },
    })
    expect(inputs.length).toBeGreaterThan(0)
    expect(next.source).toBe(expected)
  })

  it('reclassifies raw-tag children and invalidates paths from the previous lexical mode', () => {
    const original = parse('<view><child/></view>')
    const next = edit(original, {
      Element(path) {
        if (!path.isElement('view')) {
          return
        }
        const oldChild = path.get('children')[0]!
        path.rename('wxs')
        const script = path.get('children')[0]!
        expect(script.node.kind).toBe('script')
        expect(() => oldChild.rename('late')).toThrow(/active|removed|editable/i)
        path.rename('view')
        expect(path.get('children')[0]!.isElement('child')).toBe(true)
        expect(() => script.replaceWith('late')).toThrow(/active|removed|editable/i)
        expect(path.originalNode).toBe(original.children[0])
      },
    })
    expect(next.source).toBe(original.source)
    expect(next.children).toEqual(original.children)
  })

  it('traverses and renders deeply nested edits without recursive visitor calls', () => {
    const depth = 4000
    const source = `${'<view>'.repeat(depth)}before${'</view>'.repeat(depth)}`
    let entered = 0
    let exited = 0
    const next = edit(parse(source), {
      Element: {
        enter() { entered++ },
        exit() { exited++ },
      },
      Text(path) { path.replaceText('after') },
    })
    expect(entered).toBe(depth)
    expect(exited).toBe(depth)
    expect(next.source).toBe(source.replace('before', 'after'))
  })

  it.each([['view', 'wxs'], ['wxs', 'view']])('renames self-closing %s to %s without requiring script children', (from, to) => {
    const next = edit(parse(`<${from}/>`), { Element(path) {
      path.rename(to)
      expect(path.node.selfClosing).toBe(true)
      expect(path.get('children')).toEqual([])
    } })
    expect(next.source).toBe(`<${to}/>`)
  })

  it('inherits structural generation limits through newly created descendants', () => {
    expect(() => edit(parse('<target/>'), { Element(path) {
      if (path.isElement('target')) {
        path.replaceWith('<wrapper><target/></wrapper>')
      }
    } })).toThrow(/generation|limit|terminate/i)
  })
})
