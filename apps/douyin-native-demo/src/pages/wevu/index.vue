<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Vue / wevu 页面',
  usingComponents: {
    'douyin-native-card': 'douyin-native-card/card/index',
  },
})

const count = ref(0)
const npmMessage = ref('等待 Vue 页面 npm 事件')
const status = computed(() => count.value % 2 === 0 ? '偶数' : '奇数')

function increase() {
  count.value += 1
}

function handleConfirm(payload: { label: string }) {
  npmMessage.value = `Vue 收到：${payload.label}`
}
</script>

<template>
  <view id="wevu-page" class="page">
    <view class="title">Vue / wevu 页面</view>
    <view id="wevu-runtime-marker">MP_PLATFORM=tt</view>
    <view id="wevu-count">Vue 计数：{{ count }}（{{ status }}）</view>
    <button id="wevu-increase" @tap="increase">
      Vue +1
    </button>
    <douyin-native-card label="Vue 内的 npm 原生组件" @confirm="handleConfirm" />
    <view id="wevu-npm-result">{{ npmMessage }}</view>
  </view>
</template>

<style scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 36rpx 28rpx;
}

.title {
  margin-bottom: 20rpx;
  color: #fe2c55;
  font-size: 38rpx;
  font-weight: 600;
}
</style>
