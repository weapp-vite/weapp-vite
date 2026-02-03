<script>
export default {
  name: 'LibSfcBoth',
}
</script>

<script setup>
const text = 'Script + setup Vue SFC component'
</script>

<template>
  <view class="card">
    <view class="title">
      SFC (script + setup)
    </view>
    <view class="desc">
      {{ text }}
    </view>
  </view>
</template>

<style>
.card {
  padding: 20rpx;
  background: #f0fdf4;
  border: 2rpx solid #86efac;
  border-radius: 16rpx;
}

.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #166534;
}

.desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #14532d;
}
</style>
