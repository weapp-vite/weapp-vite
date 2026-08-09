import type { SetDataCounter } from '../../utils/bench'
import type { BenchPageController } from '../shared'
import { Button, Text, View } from '@weapp-vite/react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { createBenchCards, createEmptyMetrics, INDEX_CARD_COUNT, summarizeBenchCards } from '../../utils/bench'
import { BenchCards } from '../view'

export const ReactIndexPage = forwardRef<BenchPageController, { setDataCounter: SetDataCounter }>((props, ref) => {
  const [cards] = useState(() => createBenchCards(1, INDEX_CARD_COUNT))
  const [metrics, setMetrics] = useState(createEmptyMetrics)
  const summary = summarizeBenchCards(cards)

  useImperativeHandle(ref, () => ({
    finishReady(loadToReadyMs, firstCommitMs) {
      setMetrics(current => ({ ...current, loadToReadyMs, firstCommitMs }))
    },
    readBenchState() {
      return {
        readyMarker: 'react-index-ready',
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
        <View className="hero__title">React Dynamic Runtime Baseline</View>
        <View className="hero__subtitle">首屏、切页、Fiber 提交与高频更新的 React 基准页</View>
        <View className="hero__summary">{summary}</View>
        <View className="hero__metric">{`load to ready: ${metrics.loadToReadyMs}ms`}</View>
        <View className="hero__metric">{`first commit: ${metrics.firstCommitMs}ms`}</View>
        <View className="hero__metric">{`setData calls: ${props.setDataCounter.total}`}</View>
      </View>
      <View className="toolbar">
        <Button className="toolbar__btn">详情页由 benchmark runner 导航</Button>
      </View>
      <Text className="section-title">{`首屏卡片（${cards.length}）`}</Text>
      <BenchCards cards={cards} includeTags />
    </View>
  )
})
