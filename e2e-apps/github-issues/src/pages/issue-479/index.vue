<script setup lang="ts">
import { ref } from 'wevu'
import { useIssue479PageFeatureHooks } from '../../hooks/useIssue479PageFeatureHooks'

definePageJson({
  navigationBarTitleText: 'issue-479',
  enablePullDownRefresh: true,
  onReachBottomDistance: 50,
})

const logs = ref<string[]>([])
const items = Array.from({ length: 80 }, (_, index) => `issue-479-item-${index + 1}`)

useIssue479PageFeatureHooks(logs.value)

function _runE2E() {
  return {
    logs: [...logs.value],
    hasPull: logs.value.includes('pull'),
    hasBottom: logs.value.includes('bottom'),
  }
}
</script>

<template>
  <view class="issue479-page">
    <text class="issue479-title">
      issue-479 indirect page feature hooks
    </text>
    <text class="issue479-logs">
      logs: {{ logs.join(',') || 'empty' }}
    </text>
    <view class="issue479-list">
      <text v-for="item in items" :key="item" class="issue479-item">
        {{ item }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.issue479-page {
  padding: 24rpx;
}

.issue479-list {
  display: flex;
  flex-direction: column;
  margin-top: 24rpx;
}

.issue479-item {
  display: block;
  padding: 16rpx 0;
}

.issue479-title,
.issue479-logs {
  display: block;
  margin-top: 16rpx;
}
</style>
