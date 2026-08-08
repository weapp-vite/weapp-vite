import type { HostEventHandler } from '@weapp-vite/react'
import { createNativeComponent, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

interface LeafProps {
  label: string
  onChange?: HostEventHandler
  value: number
}

const NativeLeaf = createNativeComponent<LeafProps>('native-leaf')
const NativeParent = createNativeComponent('native-parent')
const WevuLeaf = createNativeComponent<LeafProps>('wevu-leaf')
const WevuParent = createNativeComponent('wevu-parent')

function formatResult(source: string, value: unknown) {
  return `${source}:${String(value ?? '')}`
}

export function ReactInteropPage() {
  const [nativeResult, setNativeResult] = useState('idle')
  const [wevuResult, setWevuResult] = useState('idle')
  const wevuValue = 2

  return (
    <View className="interop-page">
      <Text className="interop-title">React + Wevu + Native</Text>
      <View className="interop-panel" id="react-parent">
        <Text className="interop-heading">React parent</Text>
        <NativeLeaf
          id="react-parent-native"
          label="react-to-native"
          value={1}
          onChange={event => setNativeResult(formatResult('native', event.detail.value))}
        >
          <Text className="interop-slot" data-e2e-slot="react-to-native" id="slot-react-to-native" style={{ display: 'block', height: 24, width: 160 }}>slot:react-to-native</Text>
        </NativeLeaf>
        <WevuLeaf
          id="react-parent-wevu"
          label="react-to-wevu"
          value={wevuValue}
          onChange={event => setWevuResult(formatResult('wevu', event.detail.value))}
        >
          <Text className="interop-slot" data-e2e-slot="react-to-wevu" id="slot-react-to-wevu" style={{ display: 'block', height: 24, width: 160 }}>slot:react-to-wevu</Text>
        </WevuLeaf>
        <Text id="react-native-result" data-e2e-result={nativeResult}>{nativeResult}</Text>
        <Text id="react-wevu-result" data-e2e-result={wevuResult}>{wevuResult}</Text>
      </View>
      <NativeParent id="native-parent-component" />
      <WevuParent id="wevu-parent-component" />
    </View>
  )
}
