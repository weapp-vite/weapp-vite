<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-502',
})

const abc = ref(true)
const efg = ref(false)

function toggleBranch() {
  abc.value = !abc.value
  efg.value = !efg.value
}

function _runE2E() {
  return {
    abc: abc.value,
    efg: efg.value,
  }
}
</script>

<template>
  <view class="issue502-page">
    <view class="issue502-title">
      issue-502 slot condition outlet
    </view>

    <slot v-if="abc" />
    <slot v-else-if="efg" />
    <slot v-else />

    <view class="issue502-action" @tap="toggleBranch">
      toggle issue-502 branch
    </view>
  </view>
</template>

<style scoped>
.issue502-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue502-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue502-action {
  padding: 20rpx;
  margin-top: 20rpx;
  color: #0f172a;
  background: #cbd5e1;
  border-radius: 8rpx;
}
</style>
