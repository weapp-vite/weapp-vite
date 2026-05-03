<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description: string
}>(), {})
</script>

<template>
  <view class="feature">
    <view v-if="eyebrow" class="feature__eyebrow">
      {{ eyebrow }}
    </view>
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
  padding: 24rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 24rpx;
  box-shadow: 0 10rpx 30rpx rgb(15 23 42 / 4%);
}

.feature__eyebrow {
  font-size: 20rpx;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 1rpx;
}

.feature__title {
  margin-top: 8rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #0f172a;
}

.feature__desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #64748b;
}
</style>
