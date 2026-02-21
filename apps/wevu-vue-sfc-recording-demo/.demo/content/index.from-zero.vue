<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Demo Time From Zero',
})

const count = ref(0)
const doubled = computed(() => count.value * 2)

function increase() {
  count.value += 1
}

function reset() {
  count.value = 0
}
</script>

<template>
  <view class="page">
    <text class="title">weapp-vite + wevu</text>
    <text class="subtitle">Demo Time 从 0 打字演示</text>

    <view class="panel">
      <text class="line">count: {{ count }}</text>
      <text class="line">doubled: {{ doubled }}</text>
    </view>

    <view class="actions">
      <button class="btn" type="primary" @tap="increase">+1</button>
      <button class="btn" @tap="reset">Reset</button>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 36rpx;
  background: linear-gradient(180deg, #f4f8ff 0%, #edf4ff 100%);
  box-sizing: border-box;
}

.title {
  display: block;
  font-size: 42rpx;
  font-weight: 600;
  color: #0f2b52;
}

.subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  color: #45658b;
}

.panel {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}

.line {
  display: block;
  font-size: 28rpx;
  color: #1d3a64;
}

.line + .line {
  margin-top: 10rpx;
}

.actions {
  margin-top: 24rpx;
  display: flex;
  gap: 16rpx;
}

.btn {
  flex: 1;
}
</style>
