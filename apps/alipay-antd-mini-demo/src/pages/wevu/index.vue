<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'wevu SFC 示例',
  usingComponents: {
    'ant-button': 'antd-mini/Button/index',
  },
})

const count = ref(0)
const isOdd = computed(() => count.value % 2 === 1)

function increase() {
  count.value += 1
}
</script>

<template>
  <view class="page">
    <view class="panel" :class="{ odd: isOdd }">
      <text class="title">wevu SFC 页面</text>
      <text class="desc">当前计数：{{ count }}</text>
      <text class="desc">这个块使用了动态 class（会触发脚本模块标签转换）</text>
    </view>

    <ant-button type="primary" className="action-btn" @tap="increase">
      +1
    </ant-button>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40rpx 32rpx;
  box-sizing: border-box;
  background: #f7f8fc;
}

.panel {
  padding: 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
  border: 2rpx solid #dbeafe;
  margin-bottom: 24rpx;
}

.panel.odd {
  border-color: #c084fc;
  background: #faf5ff;
}

.title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 34rpx;
  font-weight: 600;
  color: #111827;
}

.desc {
  display: block;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #4b5563;
}

.action-btn {
  display: block;
}
</style>
