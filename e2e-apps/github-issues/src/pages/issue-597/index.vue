<script setup lang="ts">
const abc = true

definePageJson({
  navigationBarTitleText: 'issue-597',
})

function _runE2E() {
  return {
    ok: true,
    issue: 597,
  }
}
</script>

<template>
  <view class="issue597-page">
    <view class="issue597-title">
      issue-597 conditional named slot
    </view>

    <Issue597Card>
      <template v-if="abc" #header>
        <view class="issue597-header-a" data-issue597-branch="if" />
      </template>

      <template v-else #header>
        <text class="issue597-header-b" data-issue597-branch="else" />
      </template>
    </Issue597Card>
  </view>
</template>

<style scoped>
.issue597-page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue597-title {
  margin-bottom: 24rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}
</style>
