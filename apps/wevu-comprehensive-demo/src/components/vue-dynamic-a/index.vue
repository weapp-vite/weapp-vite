<script setup lang="ts">
const tips = [
  '这个组件用于演示 <component :is> 动态组件切换',
  '在小程序里依赖 usingComponents + data-is 机制',
  '语法覆盖为主，不保证语义与 Web 端一致',
]
</script>

<template>
  <view class="card">
    <text class="title">
      Dynamic A
    </text>
    <view class="list">
      <view v-for="(item, index) in tips" :key="index" class="item">
        <text>{{ index + 1 }}. {{ item }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* stylelint-disable order/properties-order */
.card {
  padding: 20rpx;
  border-radius: 16rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.item {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  font-size: 24rpx;
  color: #334155;
}
/* stylelint-enable order/properties-order */
</style>
