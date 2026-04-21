<script setup lang="ts">
import { ref } from 'wevu'
import { usePageFeatureHooks } from './usePageFeatureHooks'

definePageJson({
  navigationBarTitleText: 'issue-479',
  enablePullDownRefresh: true,
  onReachBottomDistance: 50,
})

const logs = ref<string[]>([])

usePageFeatureHooks(logs.value)

function _runE2E() {
  return {
    logs: [...logs.value],
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
  </view>
</template>

<style scoped>
.issue479-page {
  padding: 24rpx;
}

.issue479-title,
.issue479-logs {
  display: block;
  margin-top: 16rpx;
}
</style>
