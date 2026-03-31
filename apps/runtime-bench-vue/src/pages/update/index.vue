<script lang="ts">
import { defineComponent, nextTick, onLoad, onReady } from 'wevu'
import {
  createBenchCards,
  createEmptyMetrics,
  mutateBenchCards,
  now,
  patchSetData,
  summarizeBenchCards,
  UPDATE_CARD_COUNT,
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
    title: 'Vue Update Benchmark',
    readyMarker: '',
    summary: '',
    cards: [] as any[],
    metrics: createEmptyMetrics(),
    totalSetDataCalls: 0,
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

      const cards = createBenchCards(11, UPDATE_CARD_COUNT)
      state.readyMarker = 'vue-update-ready'
      state.summary = summarizeBenchCards(cards)
      state.cards = cards
      state.metrics = createEmptyMetrics()
      state.totalSetDataCalls = 0
    })

    onReady(() => {
      state.metrics = {
        ...state.metrics,
        loadToReadyMs: now() - loadStartedAt,
        firstCommitMs: setDataCounter.firstCommitAt ? setDataCounter.firstCommitAt - loadStartedAt : 0,
      }
      state.totalSetDataCalls = setDataCounter.total
    })

    async function readBenchState() {
      state.totalSetDataCalls = setDataCounter.total
      return buildSnapshot(state)
    }

    async function runSingleCommitBench(rounds = 180) {
      const startCalls = setDataCounter.total
      const startAt = now()
      let cards = state.cards

      for (let index = 0; index < rounds; index += 1) {
        cards = mutateBenchCards(cards, index + 1)
      }

      state.cards = cards
      state.summary = summarizeBenchCards(cards)
      await nextTick()

      state.metrics = {
        ...state.metrics,
        singleCommitMs: now() - startAt,
        singleCommitSetDataCalls: setDataCounter.total - startCalls,
      }
      state.totalSetDataCalls = setDataCounter.total

      return buildSnapshot(state)
    }

    async function runMicroCommitBench(rounds = 40) {
      const startCalls = setDataCounter.total
      const startAt = now()
      let cards = state.cards

      for (let index = 0; index < rounds; index += 1) {
        cards = mutateBenchCards(cards, index + 1)
        state.cards = cards
        state.summary = summarizeBenchCards(cards)
        await nextTick()
      }

      state.metrics = {
        ...state.metrics,
        microCommitMs: now() - startAt,
        microCommitSetDataCalls: setDataCounter.total - startCalls,
      }
      state.totalSetDataCalls = setDataCounter.total

      return buildSnapshot(state)
    }

    return {
      readBenchState,
      runSingleCommitBench,
      runMicroCommitBench,
    }
  },
})
</script>

<template>
  <view class="page">
    <view id="bench-ready-marker" class="hero">
      <view class="hero__title">{{ title }}</view>
      <view class="hero__summary">{{ summary }}</view>
      <view class="hero__metric">single commit: {{ metrics.singleCommitMs }}ms / {{ metrics.singleCommitSetDataCalls }} calls</view>
      <view class="hero__metric">micro commit: {{ metrics.microCommitMs }}ms / {{ metrics.microCommitSetDataCalls }} calls</view>
      <view class="hero__metric">setData calls: {{ totalSetDataCalls }}</view>
    </view>

    <view class="toolbar">
      <button class="toolbar__btn" size="mini" type="primary" @tap="runSingleCommitBench">单次提交</button>
      <button class="toolbar__btn" size="mini" @tap="runMicroCommitBench">多次提交</button>
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
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.hero {
  padding: 28rpx;
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

.toolbar {
  display: flex;
  gap: 16rpx;
  margin: 20rpx 0;
}

.toolbar__btn {
  flex: 1;
}

.card {
  margin-top: 12rpx;
  padding: 22rpx;
}

.card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.card__title {
  font-size: 30rpx;
  font-weight: 600;
}

.card__badge {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: #ccfbf1;
  color: #0f766e;
}

.card__badge--active {
  background: #dcfce7;
  color: #15803d;
}
</style>
