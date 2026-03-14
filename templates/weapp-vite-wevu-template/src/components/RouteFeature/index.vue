<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
}>(), {})
</script>

<template>
  <view class="feature">
    <view class="feature__title">
      {{ title }}
    </view>
    <view class="feature__desc">
      {{ description }}
    </view>
  </view>
</template>

<style>
.feature {
  padding: 20rpx 22rpx;
  margin-top: 16rpx;
  background: #f8fafc;
  border: 2rpx solid #e2e8f0;
  border-radius: 20rpx;
}

.feature__title {
  font-size: 26rpx;
  font-weight: 700;
  color: #0f172a;
}

.feature__desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #475569;
}
</style>
