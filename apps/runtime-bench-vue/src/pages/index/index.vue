<script lang="ts">
import type { BenchMetrics, SetDataCounter } from '../../utils/bench'
import { defineComponent, onLoad, onReady } from 'wevu'
import {

  createBenchCards,
  createEmptyMetrics,
  INDEX_CARD_COUNT,
  now,
  patchSetData,

  summarizeBenchCards,
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
  setup(_props, ctx) {
    const state = ctx.state as any
    const instance = ctx.instance as any
    patchSetData(instance, setDataCounter)

    onLoad(() => {
      loadStartedAt = now()
      setDataCounter.total = 0
      setDataCounter.firstCommitAt = null
      patchSetData(instance, setDataCounter)

      const cards = createBenchCards(1, INDEX_CARD_COUNT)
      state.readyMarker = 'vue-index-ready'
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

    async function navigateToDetail() {
      await new Promise<void>((resolve, reject) => {
        wx.navigateTo({
          url: '/pages/detail/index',
          success: () => resolve(),
          fail: reject,
        })
      })
      return true
    }

    async function navigateToUpdate() {
      await new Promise<void>((resolve, reject) => {
        wx.navigateTo({
          url: '/pages/update/index',
          success: () => resolve(),
          fail: reject,
        })
      })
      return true
    }

    async function navigateToUpdatePatch() {
      await new Promise<void>((resolve, reject) => {
        wx.navigateTo({
          url: '/pages/update-patch/index',
          success: () => resolve(),
          fail: reject,
        })
      })
      return true
    }

    return {
      readBenchState,
      navigateToDetail,
      navigateToUpdate,
      navigateToUpdatePatch,
    }
  },
  data: () => ({
    title: 'Vue Runtime Baseline',
    subtitle: '首屏、切页、响应式提交与高频更新的 Vue 基准页',
    readyMarker: '',
    summary: '',
    cards: [] as any[],
    metrics: createEmptyMetrics(),
    totalSetDataCalls: 0,
  }),
})
</script>

<template>
  <view class="page">
    <view id="bench-ready-marker" class="hero">
      <view class="hero__title">
        {{ title }}
      </view>
      <view class="hero__subtitle">
        {{ subtitle }}
      </view>
      <view class="hero__summary">
        {{ summary }}
      </view>
      <view class="hero__metric">
        load→ready: {{ metrics.loadToReadyMs }}ms
      </view>
      <view class="hero__metric">
        first commit: {{ metrics.firstCommitMs }}ms
      </view>
      <view class="hero__metric">
        setData calls: {{ totalSetDataCalls }}
      </view>
    </view>

    <view class="toolbar">
      <button class="toolbar__btn" size="mini" type="primary" @tap="navigateToDetail">
        切到详情页
      </button>
      <button class="toolbar__btn" size="mini" @tap="navigateToUpdate">
        切到更新页
      </button>
    </view>
    <view class="toolbar">
      <button class="toolbar__btn" size="mini" @tap="navigateToUpdatePatch">
        切到 Patch 对照页
      </button>
    </view>

    <view class="section-title">
      首屏卡片（{{ cards.length }}）
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
      <view class="card__summary">
        {{ card.summary }}
      </view>
      <view class="card__tags">
        <text v-for="tag in card.tags" :key="tag" class="card__tag">{{ tag }}</text>
      </view>
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
  font-size: 38rpx;
  font-weight: 700;
}

.hero__subtitle,
.hero__summary,
.hero__metric {
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

.section-title {
  margin: 12rpx 0;
  font-size: 28rpx;
  font-weight: 600;
}

.card {
  margin-top: 12rpx;
  padding: 22rpx;
}

.card__row,
.card__meta,
.card__tags {
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

.card__meta,
.card__summary {
  margin-top: 10rpx;
  color: #475569;
}

.card__tags {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.card__tag {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: #e2e8f0;
  font-size: 22rpx;
  color: #334155;
}
</style>
