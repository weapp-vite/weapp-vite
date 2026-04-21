<script lang="ts">
import { defineComponent } from 'wevu'
import {
  createUpdateBenchData,
  createUpdateBenchDebug,
  createUpdateBenchSetup,
  createUpdateBenchTracker,
} from '../update/shared'

const tracker = createUpdateBenchTracker()

export default defineComponent({
  setData: {
    strategy: 'patch',
    debugWhen: 'always',
    debug: createUpdateBenchDebug({ tracker }),
  },
  setup: createUpdateBenchSetup({
    strategyLabel: 'patch',
    tracker,
  }),
  data() {
    return createUpdateBenchData({
      strategyLabel: 'patch',
      title: 'Vue Update Benchmark (patch)',
    })()
  },
})
</script>

<template>
  <view class="page">
    <view id="bench-ready-marker" class="hero">
      <view class="hero__title">
        {{ title }}
      </view>
      <view class="hero__summary">
        strategy: {{ strategyLabel }} / {{ summary }}
      </view>
      <view class="hero__metric">
        single commit: {{ metrics.singleCommitMs }}ms / {{ metrics.singleCommitSetDataCalls }} calls
      </view>
      <view class="hero__metric">
        micro commit: {{ metrics.microCommitMs }}ms / {{ metrics.microCommitSetDataCalls }} calls
      </view>
      <view class="hero__metric">
        setData calls: {{ totalSetDataCalls }}
      </view>
    </view>

    <view class="toolbar">
      <button class="toolbar__btn" size="mini" type="primary" @tap="runSingleCommitBench">
        单次提交
      </button>
      <button class="toolbar__btn" size="mini" @tap="runMicroCommitBench">
        多次提交
      </button>
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
