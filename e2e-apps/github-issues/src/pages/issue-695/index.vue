<script setup lang="ts">
import { computed, onPullDownRefresh, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-695',
  enablePullDownRefresh: true,
})

const count = ref(0)
const doubled = computed(() => count.value * 2)
const logs = ref<string[]>([])

onPullDownRefresh(() => {
  count.value += 1
  logs.value.push(`pull:${count.value}`)
  // eslint-disable-next-line no-console
  console.log('[issue-695] onPullDownRefresh')
  wx.stopPullDownRefresh()
})

function _runE2E() {
  return {
    count: count.value,
    doubled: doubled.value,
    logs: [...logs.value],
    hasPull: logs.value.some(log => log.startsWith('pull:')),
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view class="issue695-page">
    <text class="issue695-title">
      issue-695 direct pull-down hook
    </text>
    <text class="issue695-count">
      count: {{ count }} doubled: {{ doubled }}
    </text>
    <text class="issue695-logs">
      logs: {{ logs.join(',') || 'empty' }}
    </text>
  </view>
</template>

<style scoped>
.issue695-page {
  padding: 24rpx;
}

.issue695-title,
.issue695-count,
.issue695-logs {
  display: block;
  margin-top: 16rpx;
}
</style>
