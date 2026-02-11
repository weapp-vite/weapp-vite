<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, ref } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
})

definePageJson({
  navigationBarTitleText: 'issue-294',
})

const shareCount = ref(0)

onShareAppMessage(() => {
  shareCount.value += 1
  return {
    title: `issue-294-share-${shareCount.value}`,
    path: '/pages/issue-294/index',
  }
})

onShareTimeline(() => {
  return {
    title: `issue-294-timeline-${shareCount.value}`,
    query: `count=${shareCount.value}`,
  }
})
</script>

<template>
  <view class="issue294-page">
    <text class="issue294-title">
      issue-294 share hooks
    </text>
    <text class="issue294-count">
      shareCount: {{ shareCount }}
    </text>
  </view>
</template>

<style scoped>
.issue294-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue294-title,
.issue294-count {
  display: block;
  margin-top: 16rpx;
  color: #334155;
  font-size: 28rpx;
}
</style>
