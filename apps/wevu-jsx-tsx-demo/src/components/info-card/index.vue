<script setup lang="ts">
interface Props {
  title: string
  description: string
}

defineProps<Props>()
</script>

<template>
  <view class="card-wrap">
    <text class="card-title">
      {{ title }}
    </text>
    <text class="card-desc">
      {{ description }}
    </text>
  </view>
</template>

<style>
.card-wrap {
  padding: 20rpx;
  border-radius: 16rpx;
  border: 2rpx dashed #38bdf8;
  background: #f0f9ff;
  margin-bottom: 16rpx;
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.card-desc {
  color: #0369a1;
}
</style>
