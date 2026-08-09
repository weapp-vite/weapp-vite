import type { BenchCard, BenchMetrics } from '../../utils/bench'
import { View } from '@weapp-vite/react'
import { summarizeBenchCards } from '../../utils/bench'
import { BenchCards } from '../view'

export function ReactUpdatePage(props: { cards: BenchCard[], metrics: BenchMetrics }) {
  return (
    <View className="page">
      <View id="bench-ready-marker" className="hero">
        <View className="hero__title">React Update Benchmark (dynamic tree)</View>
        <View className="hero__summary">{summarizeBenchCards(props.cards)}</View>
        <View className="hero__metric">{`single commit: ${props.metrics.singleCommitMs}ms / ${props.metrics.singleCommitSetDataCalls} calls`}</View>
        <View className="hero__metric">{`micro commit: ${props.metrics.microCommitMs}ms / ${props.metrics.microCommitSetDataCalls} calls`}</View>
      </View>
      <BenchCards cards={props.cards} />
    </View>
  )
}
