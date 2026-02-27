<script setup lang="ts">
import { onLoad, ref } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
})

definePageJson({
  navigationBarTitleText: 'issue-309-created',
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
  <view class="issue309-created-page">
    <text class="issue309-created-title">
      issue-309 created lifecycle onLoad hook
    </text>
    <text class="issue309-created-count">
      loadCount: {{ loadCount }}
    </text>
  </view>
</template>

<style scoped>
.issue309-created-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue309-created-title,
.issue309-created-count {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #0f172a;
}
</style>
