<script setup lang="ts">
import VanCell from '../../components/issue-574/VanCell/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-574',
})

function _runE2E() {
  return {
    ok: true,
    issue: 574,
  }
}
</script>

<template>
  <view class="issue574-page">
    <view class="issue574-title">
      issue-574 template slot order
    </view>

    <VanCell>
      <div class="issue574-default" data-order="default" />

      <template #footer1>
        <view class="issue574-footer1" data-order="footer1" />
      </template>

      <template #footer2>
        <text class="issue574-footer2" data-order="footer2" />
      </template>
    </VanCell>
  </view>
</template>

<style scoped>
.issue574-page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue574-title {
  margin-bottom: 24rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue574-default,
.issue574-footer1,
.issue574-footer2 {
  display: block;
  min-height: 32rpx;
}
</style>
