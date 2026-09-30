import type { HostEventHandler } from '@weapp-vite/react'
import { Button, createNativeComponent, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

const CounterLeaf = createNativeComponent<{ onChange?: HostEventHandler }>('counter-leaf')

export function AppView() {
  const [count, setCount] = useState(0)
  return (
    <View>
      <Text>React 示例</Text>
      <Text>
        React 计数：
        {count}
      </Text>
      <Button onTap={() => setCount(value => value + 1)}>React 加一</Button>
      <CounterLeaf onChange={() => setCount(value => value + 1)} />
      <Button onTap={() => wx.navigateTo({ url: '/pages/list/index' })}>打开 React 列表</Button>
    </View>
  )
}
