<script setup lang="ts">
import { onMounted, onUnmounted } from 'wevu'
import { ensureIssue911Guard, readIssue911Trace, recordIssue911Mounted, recordIssue911Unmounted } from '../../shared/issue911'

ensureIssue911Guard()

onMounted(() => {
  recordIssue911Mounted()
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
  <view id="issue-911-page">issue-911</view>
</template>
