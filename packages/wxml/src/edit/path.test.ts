import type { EditPath } from '../types'
import { describe, expect, it } from 'vitest'
import { edit, parse, serialize } from '../index'

describe('path-based WXML editing', () => {
  it('shares stable paths, current semantic values and explicitly original ranges', () => {
    const original = parse('<view title=\'old\'><text>hello</text></view>')
    let root: EditPath | undefined
    let child: EditPath | undefined
    const state = { count: 0 }
    const next = edit(original, {
      Element(path, state) {
        state.count++
        if (!path.parentPath) {
          root = path
          child = path.get('children')[0]!
          child.rename('label')
          path.rename('panel')
          path.setAttribute('title', 'new')
          expect(path.isElement('panel')).toBe(true)
          expect(path.getAttribute('title')?.value).toBe('new')
          expect(path.originalNode).toBe(original.children[0])
          expect(path.originalRange).toEqual({ start: 0, end: original.source.length })
          expect(path.node).not.toHaveProperty('start')
          expect(child.parentPath).toBe(path)
          expect(child.findParent(parent => parent.isElement('panel'))).toBe(path)
        }
        else {
          expect(path).toBe(child)
          expect(path.isElement('label')).toBe(true)
          expect(path.getSibling(0)).toBe(path)
          expect(path.key).toBe(0)
        }
      },
    }, state)
    expect(state.count).toBe(2)
    expect(serialize(next)).toBe('<panel title="new"><label>hello</label></panel>')
    expect(original.source).toBe('<view title=\'old\'><text>hello</text></view>')
    expect(() => root!.rename('late')).toThrow(/active|completed|editable/i)
  })

  it('runs global and kind enter/exit visitors around updated children', () => {
    const visits: string[] = []
    const next = edit(parse('<view><legacy-button/></view>'), {
      enter(path) { visits.push(`enter:${path.node.kind}`) },
      exit(path) { visits.push(`exit:${path.node.kind}`) },
      Element: {
        enter(path) {
          if (path.isElement('legacy-button')) {
            path.rename('button')
          }
        },
        exit(path) {
          if (path.isElement('view')) {
            const buttons = path.get('children').filter(child => child.isElement('button'))
            path.setAttribute('buttons', buttons.length)
          }
        },
      },
    })
    expect(visits).toEqual(['enter:element', 'enter:element', 'exit:element', 'exit:element'])
    expect(serialize(next)).toBe('<view buttons="{{1}}"><button/></view>')
  })

  it('edits inserted and replaced paths immediately and visits the resulting nodes', () => {
    const visits: string[] = []
    const next = edit(parse('<view><old/><tail/></view>'), {
      Element(path) {
        if (path.node.kind !== 'element') {
          return
        }
        visits.push(path.node.name)
        if (path.isElement('view')) {
          const [head] = path.prepend('<head/>')
          head!.setAttribute('id', 'new')
          expect(head!.originalNode).toBeUndefined()
          expect(head!.originalRange).toBeUndefined()
          expect(head!.parentPath).toBe(path)
          const [end] = path.append('<end/>')
          end!.rename('footer')
        }
        else if (path.isElement('old')) {
          const [replacement] = path.replaceWith('<replacement><inner/></replacement>')
          replacement!.setBooleanAttribute('ready')
          replacement!.get('children')[0]!.rename('content')
          expect(() => path.setBooleanAttribute('late')).toThrow(/active|removed|editable/i)
        }
      },
    })
    expect(visits).toEqual(['view', 'head', 'old', 'replacement', 'content', 'tail', 'footer'])
    expect(next.source).toBe('<view><head id="new"/><replacement ready><content/></replacement><tail/><footer/></view>')
    expect(next.children).toEqual(parse(next.source).children)
  })

  it('visits siblings inserted before and after the current path exactly once', () => {
    const visits: string[] = []
    const next = edit(parse('<root><target/><last/></root>'), {
      Element(path) {
        if (path.node.kind !== 'element') {
          return
        }
        visits.push(path.node.name)
        if (path.isElement('target')) {
          path.insertBefore('<before/>')[0]!.setBooleanAttribute('seen')
          path.insertAfter('<after/>')[0]!.setBooleanAttribute('seen')
        }
      },
    })
    expect(visits.filter(name => name === 'target')).toHaveLength(1)
    expect(visits.filter(name => name === 'before')).toHaveLength(1)
    expect(visits.filter(name => name === 'after')).toHaveLength(1)
    expect(visits).toEqual(['root', 'target', 'before', 'after', 'last'])
    expect(next.source).toBe('<root><before seen/><target/><after seen/><last/></root>')
  })

  it('supports multiple replacement roots and current sibling indices', () => {
    const next = edit(parse('<root><old/><tail/></root>'), {
      Element(path) {
        if (path.isElement('old')) {
          const replacements = path.replaceWith('<first/><second/>')
          expect(replacements).toHaveLength(2)
          expect(replacements[1]!.key).toBe(1)
          expect(replacements[1]!.getSibling(0)).toBe(replacements[0])
          replacements[0]!.remove()
          expect(replacements[1]!.key).toBe(0)
          replacements[1]!.rename('kept')
        }
      },
    })
    expect(next.source).toBe('<root><kept/><tail/></root>')
  })

  it('invalidates a replaced ancestor and discards its earlier descendant changes', () => {
    let card: EditPath | undefined
    let button: EditPath | undefined
    const visited: string[] = []
    const next = edit(parse('<card><legacy/><guard/><unvisited/></card><outside/>'), {
      Element(path) {
        if (path.node.kind !== 'element') {
          return
        }
        visited.push(path.node.name)
        if (path.isElement('card')) {
          card = path
          path.setAttribute('discarded', 'yes')
        }
        else if (path.isElement('legacy')) {
          button = path
          path.rename('button')
        }
        else if (path.isElement('guard')) {
          card!.replaceWith('<fallback/>')
          expect(() => button!.rename('late')).toThrow(/active|removed|editable/i)
        }
      },
    })
    expect(visited).toEqual(['card', 'legacy', 'guard', 'fallback', 'outside'])
    expect(next.source).toBe('<fallback/><outside/>')
  })

  it('keeps nested traverse skip and stop separate from automatic traversal', () => {
    const visited: string[] = []
    const next = edit(parse('<root><branch><leaf/></branch><peer/></root><outside/>'), {
      Element(path) {
        if (path.node.kind !== 'element') {
          return
        }
        visited.push(`auto:${path.node.name}`)
        if (path.isElement('root')) {
          path.traverse({ Element(child) {
            if (child.node.kind === 'element') {
              visited.push(`nested:${child.node.name}`)
            }
            child.setBooleanAttribute('visited')
            child.stop()
          } })
        }
        else if (path.isElement('branch')) {
          path.skip()
        }
      },
    })
    expect(visited).toEqual(['auto:root', 'nested:branch', 'auto:branch', 'auto:peer', 'auto:outside'])
    expect(next.source).toBe('<root><branch visited><leaf/></branch><peer/></root><outside/>')
  })

  it('commits edits before stop without visiting remaining roots', () => {
    const visited: string[] = []
    const next = edit(parse('<first/><second/>'), {
      Element(path) {
        if (path.node.kind === 'element') {
          visited.push(path.node.name)
        }
        path.rename('done')
        path.stop()
      },
    })
    expect(visited).toEqual(['first'])
    expect(next.source).toBe('<done/><second/>')
  })

  it('explicitly requeues a path after changing its current name', () => {
    const visited: string[] = []
    const next = edit(parse('<old/>'), {
      Element(path) {
        if (path.node.kind === 'element') {
          visited.push(path.node.name)
        }
        if (path.isElement('old')) {
          path.rename('new')
          path.requeue()
        }
      },
    })
    expect(visited).toEqual(['old', 'new'])
    expect(next.source).toBe('<new/>')
  })

  it('rejects requeue loops instead of hanging a synchronous session', () => {
    expect(() => edit(parse('<loop/>'), { Element(path) {
      path.requeue()
    } }))
      .toThrow(/requeue|loop|visit|limit|progress/i)
  })
})
