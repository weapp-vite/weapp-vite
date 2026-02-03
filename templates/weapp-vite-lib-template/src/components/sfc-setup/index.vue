<script setup>
const text = 'Script setup only Vue SFC component'
</script>

<template>
  <view class="card">
    <view class="title">
      SFC (script setup)
    </view>
    <view class="desc">
      {{ text }}
    </view>
  </view>
</template>

<style>
.card {
  padding: 20rpx;
  background: #eff6ff;
  border: 2rpx solid #93c5fd;
  border-radius: 16rpx;
}

.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1d4ed8;
}

.desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #1e40af;
}
</style>
