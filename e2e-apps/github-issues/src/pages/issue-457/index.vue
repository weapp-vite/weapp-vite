<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'issue-457',
})

const encoded = btoa('issue-457')
const decoded = atob(encoded)

function _runE2E() {
  return {
    encoded,
    decoded,
  }
}
</script>

<template>
  <view class="issue457-page">
    <text class="issue457-title">issue-457 web runtime debug readability</text>
    <text class="issue457-line">encoded = {{ encoded }}</text>
    <text class="issue457-line">decoded = {{ decoded }}</text>
  </view>
</template>

<style scoped>
.issue457-page {
  padding: 32rpx;
}

.issue457-title,
.issue457-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
