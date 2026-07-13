import type { SerializedHostNode } from '../src/runtime/types'
import { Buffer } from 'node:buffer'
import React, { createElement, useState } from 'react'
import { Button, Text, View } from '../src/runtime/components'
import { createReactMiniProgramRoot } from '../src/runtime/renderer'

function findNode(nodes: SerializedHostNode[], id: string): SerializedHostNode | undefined {
  for (const node of nodes) {
    if (node.p?.id === id) {
      return node
    }
    const nested = node.cn ? findNode(node.cn, id) : undefined
    if (nested) {
      return nested
    }
  }
  return undefined
}

const calls: Record<string, unknown>[] = []

function Scenario() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState(['alpha', 'beta'])
  return (
    <View>
      <Text id="count">{`count:${count}`}</Text>
      <Button id="increment" onTap={() => setCount(value => value + 1)}>increment</Button>
      <View>
        {items.map(item => <Text key={item}>{item}</Text>)}
      </View>
      <Button id="append" onTap={() => setItems(previous => [...previous, `item-${previous.length}`])}>append</Button>
    </View>
  )
}

const root = createReactMiniProgramRoot({
  setData(payload) {
    calls.push(payload)
  },
})

root.render(createElement(Scenario))
const initial = root.getSnapshot()
for (const id of ['increment', 'append']) {
  const node = findNode(root.getSnapshot().cn, id)
  if (!node) {
    throw new Error(`missing ${id}`)
  }
  root.dispatchEvent({
    currentTarget: {
      dataset: {
        sid: node.sid,
      },
    },
    type: 'tap',
  })
}

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value))
console.log(JSON.stringify({
  initialPayloadBytes: bytes(calls[0]),
  initialTreeNodes: JSON.stringify(initial).match(/"sid"/g)?.length ?? 0,
  listUpdateBytes: bytes(calls[2]),
  setDataCalls: calls.length,
  stateUpdateBytes: bytes(calls[1]),
  updateKeys: calls.slice(1).map(call => Object.keys(call)),
}, null, 2))
