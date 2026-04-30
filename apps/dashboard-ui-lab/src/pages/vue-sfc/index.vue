<script setup lang="ts">
import { computed, ref } from 'wevu'
import VueRuntimeCard from '../../components/VueRuntimeCard/index.vue'
import { formatBytes } from '../../shared/format'
import { createDashboardLabMetrics, createPackageScore } from '../../shared/metrics'

definePageJson({
  navigationBarTitleText: 'Vue SFC Fixture',
})

const score = createPackageScore(5)
const refreshCount = ref(1)
const metrics = computed(() => [
  ...createDashboardLabMetrics('vue'),
  {
    label: 'vue · 刷新次数',
    value: String(refreshCount.value),
    tone: 'stable' as const,
  },
])
const summary = computed(() => [
  { label: 'Vue 页面', value: '1' },
  { label: 'Vue 组件', value: '1' },
  { label: '估算体积', value: formatBytes(score.bytes + refreshCount.value * 256) },
])

function refreshRuntimeSignal() {
  refreshCount.value += 1
}
</script>

<template>
  <view class="page vue-fixture">
    <view class="panel">
      <view class="panel__title">
        Vue SFC fixture
      </view>
      <view class="panel__desc">
        wevu runtime + Vue component
      </view>
    </view>

    <view class="metric-grid">
      <VueRuntimeCard
        v-for="item in metrics"
        :key="item.label"
        :label="item.label"
        :value="item.value"
        :tone="item.tone"
      />
    </view>

    <view class="section">
      <view v-for="item in summary" :key="item.label" class="summary-row">
        <text>{{ item.label }}</text>
        <text>{{ item.value }}</text>
      </view>
    </view>

    <button class="refresh-button" type="primary" @tap="refreshRuntimeSignal">
      刷新 Vue 运行信号
    </button>
  </view>
</template>

<style scoped>
.panel {
  padding: 32rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 24rpx;
}

.panel__title {
  font-size: 40rpx;
  font-weight: 700;
}

.panel__desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgb(255 255 255 / 76%);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 28rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 24rpx;
  font-size: 28rpx;
  background: #fff;
  border-radius: 18rpx;
}

.refresh-button {
  margin-top: 28rpx;
}
</style>
