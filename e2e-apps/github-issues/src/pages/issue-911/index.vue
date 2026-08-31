<script setup lang="ts">
import { onMounted } from 'wevu'
import { ensureIssue911Guard, readIssue911Trace, recordIssue911Mounted } from '../../shared/issue911'

ensureIssue911Guard()

onMounted(() => {
  recordIssue911Mounted()
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
