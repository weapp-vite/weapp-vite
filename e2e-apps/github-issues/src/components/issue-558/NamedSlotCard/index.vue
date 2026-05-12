<script setup lang="ts">
const suffix = '-footer'
</script>

<template>
  <view class="issue558-named-card">
    <view class="issue558-named-card-header">
      <slot name="header" />
    </view>
    <view class="issue558-named-card-body">
      <slot />
    </view>
    <view class="issue558-named-card-footer">
      <slot
        name="footer"
        :suffix="suffix"
      />
    </view>
  </view>
</template>

<style scoped>
.issue558-named-card {
  padding: 20rpx;
  margin-top: 18rpx;
  background: #f8fafc;
  border: 1rpx solid #cbd5e1;
}

.issue558-named-card-header,
.issue558-named-card-body,
.issue558-named-card-footer {
  margin-top: 10rpx;
}

.issue558-named-card-header:first-child {
  margin-top: 0;
}
</style>
