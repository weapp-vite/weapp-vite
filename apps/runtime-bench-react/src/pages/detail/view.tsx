import type { SetDataCounter } from '../../utils/bench'
import type { BenchPageController } from '../shared'
import { View } from '@weapp-vite/react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { createBenchCards, createEmptyMetrics, DETAIL_CARD_COUNT, summarizeBenchCards } from '../../utils/bench'
import { BenchCards } from '../view'

export const ReactDetailPage = forwardRef<BenchPageController, { setDataCounter: SetDataCounter }>((props, ref) => {
  const [cards] = useState(() => createBenchCards(7, DETAIL_CARD_COUNT))
  const [metrics, setMetrics] = useState(createEmptyMetrics)
  const summary = summarizeBenchCards(cards)

  useImperativeHandle(ref, () => ({
    finishReady(loadToReadyMs, firstCommitMs) {
      setMetrics(current => ({ ...current, loadToReadyMs, firstCommitMs }))
    },
    readBenchState() {
      return {
        readyMarker: 'react-detail-ready',
        cardCount: cards.length,
        summary,
        metrics,
        totalSetDataCalls: props.setDataCounter.total,
      }
    },
  }), [cards.length, metrics, props.setDataCounter, summary])

  return (
    <View className="page">
      <View id="bench-ready-marker" className="hero">
        <View className="hero__title">React Detail Navigation Target</View>
        <View className="hero__summary">{summary}</View>
        <View className="hero__metric">{`load to ready: ${metrics.loadToReadyMs}ms`}</View>
        <View className="hero__metric">{`first commit: ${metrics.firstCommitMs}ms`}</View>
      </View>
      <BenchCards cards={cards} />
    </View>
  )
})
