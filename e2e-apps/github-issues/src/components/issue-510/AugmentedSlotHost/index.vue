<script setup lang="ts">
import { provide } from 'wevu'

const ISSUE_510_KEY = 'issue-510:slot-provide'

defineComponentJson({
  component: true,
})

provide(ISSUE_510_KEY, 'issue-510-provider')
</script>

<template>
  <view class="issue510-slot-host" data-issue510-host="true">
    <view class="issue510-slot-host__label">
      issue-510 host
    </view>
    <slot />
  </view>
</template>

<style scoped>
.issue510-slot-host {
  padding: 20rpx;
  background: #fff;
  border: 2rpx solid #64748b;
  border-radius: 8rpx;
}

.issue510-slot-host__label {
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #334155;
}
</style>
