import type { BenchMetrics } from '../../utils/bench'
import { Text, View } from '@weapp-vite/react'

export function ReactStaticUpdatePage(props: { metrics: BenchMetrics, value: number }) {
  return (
    <View className="page">
      <View id="bench-ready-marker" className="hero">
        <Text className="hero__title">React Static Binding Benchmark</Text>
        <Text className="hero__summary">{`value=${props.value}`}</Text>
        <Text className="hero__metric">{`single commit: ${props.metrics.singleCommitMs}ms`}</Text>
        <Text className="hero__metric">{`micro commit: ${props.metrics.microCommitMs}ms`}</Text>
      </View>
    </View>
  )
}
