<script lang="ts">
import { defineComponent, onLoad, onReady } from 'wevu'
import {
  createBenchCards,
  createEmptyMetrics,
  DETAIL_CARD_COUNT,
  now,
  patchSetData,
  summarizeBenchCards,
  type BenchMetrics,
  type SetDataCounter,
} from '../../utils/bench'

const setDataCounter: SetDataCounter = {
  total: 0,
  firstCommitAt: null,
}

let loadStartedAt = 0

function buildSnapshot(data: {
  cards: unknown[]
  metrics: BenchMetrics
  readyMarker: string
  summary: string
}) {
  return {
    readyMarker: data.readyMarker,
    cardCount: data.cards.length,
    summary: data.summary,
    metrics: data.metrics,
    totalSetDataCalls: setDataCounter.total,
  }
}

export default defineComponent({
  data: () => ({
    title: 'Vue Detail Navigation Target',
    readyMarker: '',
    summary: '',
    cards: [] as any[],
    metrics: createEmptyMetrics(),
  }),
  setup(_props, ctx) {
    const state = ctx.state as any
    const instance = ctx.instance as any
    patchSetData(instance, setDataCounter)

    onLoad(() => {
      loadStartedAt = now()
      setDataCounter.total = 0
      setDataCounter.firstCommitAt = null
      patchSetData(instance, setDataCounter)

      const cards = createBenchCards(7, DETAIL_CARD_COUNT)
      state.readyMarker = 'vue-detail-ready'
      state.summary = summarizeBenchCards(cards)
      state.cards = cards
      state.metrics = createEmptyMetrics()
    })

    onReady(() => {
      state.metrics = {
        ...state.metrics,
        loadToReadyMs: now() - loadStartedAt,
        firstCommitMs: setDataCounter.firstCommitAt ? setDataCounter.firstCommitAt - loadStartedAt : 0,
      }
    })

    async function readBenchState() {
      return buildSnapshot(state)
    }

    return {
      readBenchState,
    }
  },
})
</script>

<template>
  <view class="page">
    <view id="bench-ready-marker" class="hero">
      <view class="hero__title">{{ title }}</view>
      <view class="hero__summary">{{ summary }}</view>
      <view class="hero__metric">load→ready: {{ metrics.loadToReadyMs }}ms</view>
      <view class="hero__metric">first commit: {{ metrics.firstCommitMs }}ms</view>
    </view>

    <view v-for="card in cards" :key="card.id" class="card">
      <view class="card__row">
        <text class="card__title">{{ card.title }}</text>
        <text class="card__badge" :class="{ 'card__badge--active': card.active }">
          {{ card.active ? 'active' : 'idle' }}
        </text>
      </view>
      <view class="card__meta">
        <text>score {{ card.score }}</text>
        <text>delta {{ card.delta }}</text>
      </view>
      <view class="card__summary">{{ card.summary }}</view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.hero,
.card {
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 30rpx rgb(15 23 42 / 6%);
}

.hero {
  padding: 28rpx;
  margin-bottom: 16rpx;
}

.hero__title {
  font-size: 36rpx;
  font-weight: 700;
}

.hero__summary,
.hero__metric,
.card__meta,
.card__summary {
  margin-top: 10rpx;
  color: #475569;
}

.card {
  padding: 22rpx;
  margin-top: 12rpx;
}

.card__row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.card__title {
  font-size: 30rpx;
  font-weight: 600;
}

.card__badge {
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  color: #0f766e;
  background: #ccfbf1;
  border-radius: 999rpx;
}

.card__badge--active {
  color: #15803d;
  background: #dcfce7;
}
</style>
