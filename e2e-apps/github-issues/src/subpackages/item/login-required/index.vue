<script setup lang="ts">
import { useIssue340SharedMessage } from '../issue-340-shared'

definePageJson({
  navigationBarTitleText: 'issue-340-item-login-required',
})

const { readMessage } = useIssue340SharedMessage('item-login-required')
const message = readMessage()

function _runE2E() {
  return {
    ok: message === 'item-login-required:issue-340:shared',
    message,
  }
}
</script>

<template>
  <view class="issue340-page">
    <text class="issue340-title">
      issue-340 item login required
    </text>
    <text class="issue340-message">
      {{ message }}
    </text>
  </view>
</template>

<style scoped>
.issue340-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue340-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue340-message {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #334155;
}
</style>
