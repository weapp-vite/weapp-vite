<script setup lang="ts">
import { onMounted } from 'wevu'

defineComponentJson({
  component: true,
})

const issue398NavbarLabel = 'issue-398 navbar'

onMounted(() => {
  const currentPage = (getCurrentPages() as Array<Record<string, any>>).at(-1)
  if (!currentPage) {
    return
  }
  currentPage.__issue398NavbarMounted = true
  currentPage.__issue398NavbarLabel = issue398NavbarLabel
})

function _runE2E() {
  return {
    label: issue398NavbarLabel,
  }
}
</script>

<template>
  <view class="issue-398-navbar">
    <text>{{ issue398NavbarLabel }}</text>
  </view>
</template>

<style>
.issue-398-navbar {
  padding: 16rpx;
  background: #e2e8f0;
}
</style>
