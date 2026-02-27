<script setup lang="ts">
import { onLoad, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-309',
  backgroundColor: '#ffffff',
})

const loadCount = ref(0)

onLoad(() => {
  loadCount.value += 1
})

function _runE2E() {
  return {
    loadCount: loadCount.value,
    ok: loadCount.value > 0,
  }
}
</script>

<template>
  <view class="issue309-page">
    <text class="issue309-title">
      issue-309 onLoad hook
    </text>
    <text class="issue309-count">
      loadCount: {{ loadCount }}
    </text>
  </view>
</template>

<style scoped>
.issue309-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue309-title,
.issue309-count {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #0f172a;
}
</style>
