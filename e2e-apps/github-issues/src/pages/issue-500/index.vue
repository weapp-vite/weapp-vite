<script setup lang="ts">
import { computed, inject, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-500',
})

const afterMissingInjectRan = ref(false)
const missingValue = inject<string>('issue-500:missing-token')
afterMissingInjectRan.value = true

const continuationText = computed(() => afterMissingInjectRan.value ? 'continued' : 'blocked')
const missingType = computed(() => missingValue === undefined ? 'undefined' : typeof missingValue)

function _runE2E() {
  return {
    ok: afterMissingInjectRan.value && missingValue === undefined,
    continuationText: continuationText.value,
    missingType: missingType.value,
  }
}
</script>

<template>
  <view class="issue500-page">
    <view class="issue500-title">
      issue-500 inject missing key continuation
    </view>
    <view
      class="issue500-status"
      :data-continuation="continuationText"
      :data-missing-type="missingType"
    >
      inject after line: {{ continuationText }}
    </view>
  </view>
</template>

<style scoped>
.issue500-page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue500-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue500-status {
  color: #166534;
}
</style>
