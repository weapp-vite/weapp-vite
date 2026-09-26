<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'wevu'
import { ensureIssue911Guard, readIssue911Trace, recordIssue911Mounted, recordIssue911Unmounted } from '../../shared/issue911'

ensureIssue911Guard()
const mountedTrace = ref('pending')

onMounted(() => {
  recordIssue911Mounted()
  mountedTrace.value = readIssue911Trace().join(' > ')
})

onUnmounted(() => {
  recordIssue911Unmounted()
})

function _runE2E() {
  return readIssue911Trace()
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view id="issue-911-page">
    <view id="issue911-title">issue-911 async guard</view>
    <view id="issue911-mounted-trace">{{ mountedTrace }}</view>
  </view>
</template>
