<script setup lang="ts">
defineProps<{
  root: {
    a: string
  }
}>()
</script>

<template>
  <view id="info-banner" class="info-banner">
    {{ root.a }}
  </view>
</template>

<style scoped>
.info-banner {
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  color: #1e293b;
  background: #e2e8f0;
  font-size: 26rpx;
  font-weight: 500;
}
</style>
