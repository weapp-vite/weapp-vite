<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: '录屏 120s 起始态',
})

interface DemoFeature {
  name: string
  done: boolean
  level: 'core' | 'plus'
}

const projectName = ref('weapp-vite + wevu')
const clicks = ref(0)
const keyword = ref('')
const features = ref<DemoFeature[]>([
  { name: 'Vue SFC 编译', done: true, level: 'core' },
  { name: 'definePageJson 宏', done: true, level: 'core' },
  { name: 'wevu 组合式 API', done: false, level: 'plus' },
  { name: '智能提示录屏演示', done: false, level: 'plus' },
])

function increase() {
  clicks.value += 1
}

function toggle(index: number) {
  const target = features.value[index]
  if (!target)
    return

  target.done = !target.done
}
</script>

<template>
  <view class="page">
    <text class="title">{{ projectName }}</text>
    <text class="subtitle">目标：120 秒展示真实编码流（含一次修正）。</text>

    <view class="card">
      <view class="row between">
        <text class="label">点击计数</text>
        <text class="value">{{ clicks }}</text>
      </view>

      <view class="row between">
        <text class="label">筛选关键词</text>
        <input class="keyword-input" :value="keyword" placeholder="输入关键词" />
      </view>

      <view class="action-row">
        <button class="btn" type="primary" @tap="increase">+1</button>
      </view>
    </view>

    <view class="feature-list">
      <view
        v-for="(item, index) in features"
        :key="item.name"
        class="feature-item"
        @tap="toggle(index)"
      >
        <text class="feature-name">{{ item.name }}</text>
        <text class="feature-state">{{ item.done ? '已完成' : '待完成' }}</text>
      </view>
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

.row {
  display: flex;
  align-items: center;
}

.between {
  justify-content: space-between;
}

.row + .row {
  margin-top: 16rpx;
}

.label {
  font-size: 28rpx;
  color: #5c6f89;
}

.value {
  font-size: 30rpx;
  font-weight: 600;
  color: #14315b;
}

.keyword-input {
  width: 300rpx;
  height: 56rpx;
  padding: 0 16rpx;
  border: 1rpx solid #dbe6f5;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.action-row {
  margin-top: 24rpx;
}

.btn {
  width: 220rpx;
}

.feature-list {
  margin-top: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
  overflow: hidden;
}

.feature-item {
  padding: 22rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feature-item + .feature-item {
  border-top: 1rpx solid #e8eef7;
}

.feature-name {
  font-size: 28rpx;
  color: #1d3a64;
}

.feature-state {
  font-size: 24rpx;
  color: #cc7a1f;
}
</style>
