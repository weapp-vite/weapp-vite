<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue547-cell" data-issue547-cell="true">
    <slot />
  </view>
</template>

<style scoped>
.issue547-cell {
  padding: 16rpx;
  background: #ecfeff;
  border: 2rpx solid #0891b2;
  border-radius: 8rpx;
}
</style>
