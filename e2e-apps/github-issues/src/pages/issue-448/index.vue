<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-448',
})

definePageMeta({
  layout: false,
})

const encoded = btoa('AB')
const decoded = atob(encoded)
const duration = Number(performance.now().toFixed(2))
const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(4))).join(',')
const eventType = new Event('tick').type
const customEventType = new CustomEvent('payload', {
  detail: {
    ok: true,
  },
}).type
const microtaskState = ref('pending')

queueMicrotask(() => {
  microtaskState.value = 'flushed'
})

function _runE2E() {
  return {
    encoded,
    decoded,
    duration,
    randomBytes,
    eventType,
    customEventType,
    microtaskState: microtaskState.value,
  }
}
</script>

<template>
  <view class="issue448-page">
    <text class="issue448-title">issue-448 next web runtime globals</text>
    <text class="issue448-line">encoded = {{ encoded }}</text>
    <text class="issue448-line">decoded = {{ decoded }}</text>
    <text class="issue448-line">duration = {{ duration }}</text>
    <text class="issue448-line">random = {{ randomBytes }}</text>
    <text class="issue448-line">event = {{ eventType }}</text>
    <text class="issue448-line">custom = {{ customEventType }}</text>
    <text class="issue448-line">microtask = {{ microtaskState }}</text>
  </view>
</template>

<style scoped>
.issue448-page {
  padding: 32rpx;
}

.issue448-title,
.issue448-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
