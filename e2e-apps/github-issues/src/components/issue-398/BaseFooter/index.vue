<script setup lang="ts">
import { onMounted } from 'wevu'

defineComponentJson({
  component: true,
})

const issue398FooterLabel = 'issue-398 footer'

onMounted(() => {
  const currentPage = (getCurrentPages() as Array<Record<string, any>>).at(-1)
  if (!currentPage) {
    return
  }
  currentPage.__issue398FooterMounted = true
  currentPage.__issue398FooterLabel = issue398FooterLabel
})

function _runE2E() {
  return {
    label: issue398FooterLabel,
  }
}
</script>

<template>
  <view class="issue-398-footer">
    <text>{{ issue398FooterLabel }}</text>
  </view>
</template>

<style>
.issue-398-footer {
  padding: 16rpx;
  background: #cbd5e1;
}
</style>
