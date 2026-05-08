<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue558-cell">
    <slot />
  </view>
</template>

<style scoped>
.issue558-cell {
  padding: 16rpx;
  background: #fff;
  border: 2rpx solid #64748b;
  border-radius: 8rpx;
}
</style>
