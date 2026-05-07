<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue547-group" data-issue547-group="true">
    <view class="issue547-group__title">
      issue-547 nested slot group
    </view>
    <slot />
  </view>
</template>

<style scoped>
.issue547-group {
  padding: 20rpx;
  background: #f8fafc;
  border: 2rpx solid #475569;
  border-radius: 8rpx;
}

.issue547-group__title {
  margin-bottom: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}
</style>
