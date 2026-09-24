import type { WxmlTransformNode } from '../../types'
import { describe, expect, it, vi } from 'vitest'
import * as scanner from '../template/scan'
import { editWxml } from './editor'

const file = 'pages/subtree/index.wxml'

describe('WXML subtree editing', () => {
  it('shares child handles and current state with the automatic visitor after one scan', async () => {
    const scan = vi.spyOn(scanner, 'scanTemplate')
    const seen: WxmlTransformNode[] = []
    let child: WxmlTransformNode | undefined
    try {
      const result = await editWxml('<view>text<!-- keep --><text/><wxs module="x">var x="<text/>";</wxs></view>', file, 'legacy', (node) => {
        seen.push(node)
        if (!node.parent) {
          expect(node.children.map(child => child.tagName)).toEqual(['text', 'wxs'])
          expect(Object.isFrozen(node.children)).toBe(true)
          child = node.children[0]!
          child.renameTag('button')
          child.setAttribute('size', 'mini')
          expect(child.parent?.children[0]?.tagName).toBe('button')
          expect(child.parent?.children[0]).not.toHaveProperty('setAttribute')
          expect(child.parent?.children[0]).not.toHaveProperty('walk')
        }
      })
      expect(scan).toHaveBeenCalledTimes(1)
      expect(seen[1]).toBe(child)
      expect(seen.map(node => node.tagName)).toEqual(['view', 'button', 'wxs'])
      expect(result).toContain('<button size="mini"/>')
    }
    finally {
      scan.mockRestore()
    }
  })

  it('waits for nested walks without changing the automatic walk or other skip states', async () => {
    const visits: string[] = []
    await editWxml('<root><branch><leaf/></branch><peer/></root><outside/>', file, 'legacy', async (node) => {
      visits.push(`auto:${node.tagName}`)
      if (node.tagName === 'root') {
        await node.walk(async (child) => {
          await Promise.resolve()
          visits.push(`manual:${child.tagName}`)
          if (child.tagName === 'branch') {
            await child.walk((leaf) => {
              visits.push(`nested:${leaf.tagName}`)
            })
            child.skipChildren()
            child.skipChildren()
          }
        })
      }
    })
    expect(visits).toEqual(['auto:root', 'manual:branch', 'nested:leaf', 'manual:peer', 'auto:branch', 'auto:leaf', 'auto:peer', 'auto:outside'])
  })

  it('skips only the current traversal and still permits explicit walks after skipChildren', async () => {
    const visits: string[] = []
    await editWxml('<root><branch><leaf/></branch></root><peer/>', file, 'legacy', async (node) => {
      visits.push(node.tagName)
      if (node.tagName === 'root') {
        node.skipChildren()
        await node.walk((child) => {
          visits.push(`manual:${child.tagName}`)
        })
      }
    })
    expect(visits).toEqual(['root', 'manual:branch', 'manual:leaf', 'peer'])
  })

  it('rejects skipping a different node or a completed visitor with a source position', async () => {
    await expect(editWxml('\r\n<root><leaf/></root>', file, 'legacy', (node) => {
      node.children[0]!.skipChildren()
    })).rejects.toThrow('skipChildren must be called on the current visitor node')
    let previous: WxmlTransformNode | undefined
    await expect(editWxml('<root><leaf/></root>', file, 'legacy', (node) => {
      if (previous) {
        previous.skipChildren()
      }
      previous = node
    })).rejects.toThrow(file)
    await editWxml('<root/>', file, 'legacy', (node) => {
      previous = node
    })
    expect(() => previous!.skipChildren()).toThrow('no longer editable')
    expect(() => previous!.walk(() => {})).toThrow('no longer editable')
  })

  it('invalidates deleted subtrees immediately while keeping old child arrays as snapshots', async () => {
    const visits: string[] = []
    const output = await editWxml('<root><branch><leaf/></branch><peer/></root>', file, 'legacy', (node) => {
      visits.push(node.tagName)
      if (node.tagName === 'root') {
        const snapshot = node.children
        const leaf = snapshot[0]!.children[0]!
        snapshot[0]!.remove()
        expect(snapshot).toHaveLength(2)
        expect(node.children.map(child => child.tagName)).toEqual(['peer'])
        expect(() => leaf.setAttribute('value', 'gone')).toThrow('no longer editable')
        expect(() => snapshot[0]!.walk(() => {})).toThrow('no longer editable')
      }
    })
    expect(visits).toEqual(['root', 'peer'])
    expect(output).toBe('<root><peer/></root>')
  })

  it('discards previous descendant edits when an ancestor is deleted during a nested walk', async () => {
    const visits: string[] = []
    const output = await editWxml('<root><branch><leaf/></branch><peer/></root><outside/>', file, 'legacy', async (node) => {
      visits.push(`auto:${node.tagName}`)
      if (node.tagName === 'root') {
        const leaf = node.children[0]!.children[0]!
        leaf.setAttribute('value', 'discard')
        await node.walk((child) => {
          visits.push(`manual:${child.tagName}`)
          node.remove()
          expect(() => child.renameTag('gone')).toThrow('no longer editable')
        })
      }
    })
    expect(output).toBe('<outside/>')
    expect(visits).toEqual(['auto:root', 'manual:branch', 'auto:outside'])
  })

  it('keeps protection and conditional-chain checks through child handles', async () => {
    await expect(editWxml('<view><button bindtap="tap"/></view>', file, 'legacy', (node) => {
      node.children[0]!.removeAttribute('bindtap')
    })).rejects.toThrow('protected attribute')
    await expect(editWxml('<view><block/></view>', file, 'legacy', (node) => {
      node.children[0]!.remove()
    })).rejects.toThrow('structural tag')
    await expect(editWxml('<view><debug wx:if="{{ok}}"/><text wx:else/></view>', file, 'legacy', (node) => {
      node.children[0]!.remove()
      node.skipChildren()
    })).rejects.toThrow('chain')
    expect(await editWxml('<view><debug wx:if="{{ok}}"/><text wx:else/></view>', file, 'legacy', (node) => {
      for (const child of node.children) {
        child.remove()
      }
    })).toBe('<view></view>')
  })

  it('propagates nested callback failures and expires retained handles', async () => {
    const cause = new Error('nested failure')
    let retained: WxmlTransformNode | undefined
    await expect(editWxml('<view><text/></view>', file, 'legacy', node => node.walk((child) => {
      retained = child
      child.setAttribute('value', 'unpublished')
      throw cause
    }))).rejects.toBe(cause)
    expect(() => retained!.setAttribute('value', 'late')).toThrow('no longer editable')
  })

  it('rejects concurrent walks and unawaited work without unhandled rejections', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    try {
      await expect(editWxml('<view><text/></view>', file, 'legacy', async (node) => {
        const first = node.walk(async () => {
          await gate
        })
        await Promise.all([first, node.walk(() => {})])
      })).rejects.toThrow('concurrent editing')
      await expect(editWxml('<view><text/></view>', file, 'legacy', (node) => {
        void node.walk(async (child) => {
          await gate
          child.setAttribute('value', 'late')
        })
      })).rejects.toThrow('await or return')
    }
    finally {
      release()
    }
  })

  it.each(['legacy', 'xml'] as const)('preserves untouched bytes and original locations in %s templates', async (syntax) => {
    const source = '<!-- keep -->\r\n<view>\r\n <text title="&amp; {{value}}"/>\r\n</view>'
    const output = await editWxml(source, file, syntax, async (node) => {
      if (!node.parent) {
        await node.walk((child) => {
          expect(child.location).toEqual({ offset: source.indexOf('<text'), line: 3, column: 2 })
          child.renameAttribute('title', 'data-label')
        })
        node.skipChildren()
      }
    })
    expect(output).toBe(source.replace('title=', 'data-label='))
  })

  it('handles empty children and deeply nested source without recursive tree construction', async () => {
    const source = `${'<view>'.repeat(12000)}<text/>${'</view>'.repeat(12000)}`
    let count = 0
    expect(await editWxml(source, file, 'legacy', async (node) => {
      if (!node.parent) {
        await node.walk(() => {
          count++
        })
        node.skipChildren()
      }
    })).toBe(source)
    expect(count).toBe(12000)
    expect(await editWxml('<view/>', file, 'legacy', async (node) => {
      expect(node.children).toEqual([])
      await node.walk(() => {
        throw new Error('unreachable')
      })
    })).toBe('<view/>')
  })
})
