<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Wevu 模板',
})

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="hero__title">
        Weapp-vite + Wevu
      </view>
      <view class="hero__desc">
        一个尽量小的 Vue SFC 小程序起点，复杂能力示例请看 e2e-apps。
      </view>
      <view class="counter">
        <text>count: {{ count }}</text>
        <text>double: {{ doubled }}</text>
      </view>
      <button class="action-btn" @tap="count += 1">
        +1
      </button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #f3f6fb;
}

.card {
  padding: 32rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 24rpx;
}

.hero__title {
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
}

.hero__desc {
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #475569;
}

.counter {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
  font-size: 26rpx;
  color: #0f172a;
}

.action-btn {
  margin-top: 24rpx;
  color: #fff;
  background: #0f172a;
  border-radius: 999rpx;
}
</style>
