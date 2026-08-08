import type { HostEventHandler } from '@weapp-vite/react'
import { createNativeComponent, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

interface LeafProps {
  label: string
  onChange?: HostEventHandler
  value: number
}

const NativeLeaf = createNativeComponent<LeafProps>('native-leaf')
const WevuLeaf = createNativeComponent<LeafProps>('wevu-leaf')

export function AppView() {
  const [count, setCount] = useState(0)
  return (
    <View className="page">
      <Text className="title">React 组件互操作</Text>
      <NativeLeaf
        id="native-leaf"
        label="React → 原生"
        value={count}
        onChange={event => setCount(Number(event.detail.value))}
      >
        <Text className="slot-content">React 默认插槽</Text>
      </NativeLeaf>
      <WevuLeaf
        id="wevu-leaf"
        label="React → Wevu"
        value={count}
        onChange={event => setCount(Number(event.detail.value))}
      >
        <Text className="slot-content">
          同一份状态：
          {count}
        </Text>
      </WevuLeaf>
    </View>
  )
}
