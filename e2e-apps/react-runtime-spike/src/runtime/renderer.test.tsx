import type { SerializedHostNode } from './types'
import { createElement, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Button, Text, View } from './components'
import { createReactMiniProgramRoot } from './renderer'

function findNode(nodes: SerializedHostNode[], predicate: (node: SerializedHostNode) => boolean): SerializedHostNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) {
      return node
    }
    const nested = node.cn ? findNode(node.cn, predicate) : undefined
    if (nested) {
      return nested
    }
  }
  return undefined
}

describe('react runtime spike renderer', () => {
  it('renders hooks and routes host events into path-level setData updates', () => {
    const calls: Record<string, unknown>[] = []

    function Counter() {
      const [count, setCount] = useState(0)
      return (
        <View className="counter" style={{ opacity: 0.8, paddingTop: 12 }}>
          <Text id="value">{`count:${count}`}</Text>
          <Button id="increment" onTap={() => setCount(value => value + 1)}>increment</Button>
        </View>
      )
    }

    const root = createReactMiniProgramRoot({
      setData(payload) {
        calls.push(payload)
      },
    })

    root.render(createElement(Counter))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveProperty('root')
    const initial = root.getSnapshot()
    const button = findNode(initial.cn, node => node.p?.id === 'increment')
    expect(button?.sid).toBeTruthy()
    expect(initial.cn[0]?.cl).toBe('counter')
    expect(initial.cn[0]?.st).toContain('padding-top:12px')

    root.dispatchEvent({
      currentTarget: {
        dataset: {
          sid: button!.sid,
        },
      },
      type: 'tap',
    })

    expect(calls).toHaveLength(2)
    const updateKeys = Object.keys(calls[1]!)
    expect(updateKeys).toHaveLength(1)
    expect(updateKeys[0]).toMatch(/^root\.cn\[0\]\.cn\[0\]\.cn\[0\]$/)
    expect(JSON.stringify(calls[1])).toContain('count:1')
  })

  it('replaces the nearest child array for keyed list structure changes', () => {
    const calls: Record<string, unknown>[] = []

    function List() {
      const [items, setItems] = useState(['a', 'b'])
      return (
        <View>
          {items.map(item => <Text key={item}>{item}</Text>)}
          <Button id="append" onTap={() => setItems(previous => [...previous, 'c'])}>append</Button>
        </View>
      )
    }

    const root = createReactMiniProgramRoot({
      setData(payload) {
        calls.push(payload)
      },
    })

    root.render(createElement(List))
    const button = findNode(root.getSnapshot().cn, node => node.p?.id === 'append')
    root.dispatchEvent({
      currentTarget: {
        dataset: {
          sid: button!.sid,
        },
      },
      type: 'tap',
    })

    expect(calls).toHaveLength(2)
    expect(Object.keys(calls[1]!)).toEqual(['root.cn[0].cn'])
    expect(JSON.stringify(calls[1])).toContain('"v":"c"')

    root.unmount()
    expect(calls.at(-1)).toEqual({ 'root.cn': [] })
  })

  it('supports keyed insertion before an existing host child', () => {
    const calls: Record<string, unknown>[] = []

    function List() {
      const [items, setItems] = useState(['b', 'c'])
      return (
        <View>
          {items.map(item => <Text key={item}>{item}</Text>)}
          <Button id="prepend" onTap={() => setItems(previous => ['a', ...previous])}>prepend</Button>
        </View>
      )
    }

    const root = createReactMiniProgramRoot({
      setData(payload) {
        calls.push(payload)
      },
    })

    root.render(createElement(List))
    const button = findNode(root.getSnapshot().cn, node => node.p?.id === 'prepend')
    root.dispatchEvent({
      currentTarget: {
        dataset: {
          sid: button!.sid,
        },
      },
      type: 'tap',
    })

    expect(Object.keys(calls[1]!)).toEqual(['root.cn[0].cn'])
    expect((calls[1]!['root.cn[0].cn'] as SerializedHostNode[])[0]?.cn?.[0]?.v).toBe('a')
  })
})
