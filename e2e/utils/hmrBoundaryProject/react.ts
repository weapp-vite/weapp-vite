export const reactPageSource = `import { Button, Input, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

const marker = 'STATEFUL-NATIVE-BASE'

export function CapabilityPage() {
  const [count, setCount] = useState(0)
  const [input, setInput] = useState('')
  const app = getApp()
  app.globalData ??= {}
  app.globalData.capabilitySnapshot = { marker, count, input }
  return (
    <View className="page">
      <Text className="marker">{marker}</Text>
      <Text className="count">{String(count)}</Text>
      <Input className="input" value={input} onInput={event => setInput(String(event.detail.value ?? ''))} />
      <Button className="increment" onTap={() => setCount(count + 1)}>increment</Button>
    </View>
  )
}
`

export const reactEntrySource = `import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement } from 'react'
import { CapabilityPage } from './view'

const roots = new WeakMap<object, ReturnType<typeof createReactMiniProgramRoot>>()

Page({
  data: { slots: {} },
  __weapp_vite_react_event(event: WechatMiniprogram.BaseEvent) {
    roots.get(this)?.dispatchEvent(event)
  },
  onLoad() {
    const root = createReactMiniProgramRoot({
      setData: (payload, callback) => this.setData(payload, callback),
    }, { renderMode: 'static-bindings' })
    roots.set(this, root)
    root.render(createElement(CapabilityPage))
  },
  onUnload() {
    roots.get(this)?.unmount()
    roots.delete(this)
  },
})
`
