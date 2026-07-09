<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-706',
})

const probeStatus = ref('ready')
const probeMessage = ref('issue-706 automator page rpc ready')

function _runE2E() {
  return {
    message: probeMessage.value,
    ok: probeStatus.value === 'ready',
    status: probeStatus.value,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="issue706-page"
    class="issue706-page"
  >
    <view class="hello" data-issue706-status="ready">
      {{ probeMessage }}
    </view>
    <text class="issue706-status">
      {{ probeStatus }}
    </text>
  </view>
</template>

<style scoped>
.issue706-page {
  padding: 24rpx;
}

.hello,
.issue706-status {
  display: block;
  margin-top: 16rpx;
}
</style>
