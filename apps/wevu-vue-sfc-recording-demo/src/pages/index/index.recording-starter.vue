<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: '录屏起始态',
})

const projectName = ref('weapp-vite + wevu')
const clicks = ref(0)

function increase() {
  clicks.value += 1
}
</script>

<template>
  <view class="page">
    <text class="title">{{ projectName }}</text>
    <text class="subtitle">在 VSCode 里继续补全这页代码，演示智能提示与保存效果。</text>

    <view class="card">
      <text class="count">当前点击：{{ clicks }}</text>
      <button class="btn" type="primary" @tap="increase">+1</button>
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

.card {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.count {
  display: block;
  margin-bottom: 18rpx;
  font-size: 30rpx;
}

.btn {
  width: 220rpx;
}
</style>
