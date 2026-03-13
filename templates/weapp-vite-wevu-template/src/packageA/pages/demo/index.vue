<script setup lang="ts">
import { wxRouter } from 'weapp-vite/auto-routes'
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: '普通分包页',
})

const steps = ref([
  '在 vite.config.ts 中声明 weapp.subPackages.packageA',
  '将页面放到 src/packageA/pages/** 目录下',
  '通过 autoRoutes 自动生成 app.json 里的 subPackages',
])

const summary = computed(() => {
  return `当前共 ${steps.value.length} 个分包接入步骤`
})

function backHome() {
  wxRouter.navigateBack()
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">
        packageA
      </text>
      <text class="title">
        autoRoutes 普通分包示例
      </text>
      <text class="summary">
        {{ summary }}
      </text>
    </view>

    <view class="panel">
      <view v-for="item in steps" :key="item" class="step">
        <text class="step-index">
          ·
        </text>
        <text class="step-text">
          {{ item }}
        </text>
      </view>
    </view>

    <button class="back-btn" @tap="backHome">
      返回上一页
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 36rpx 30rpx;
  background:
    radial-gradient(circle at top left, rgb(76 110 245 / 16%), transparent 38%),
    linear-gradient(180deg, #f8faff 0%, #eef2ff 100%);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  background: #fff;
  border: 2rpx solid rgb(76 110 245 / 12%);
  border-radius: 28rpx;
  box-shadow: 0 18rpx 40rpx rgb(76 110 245 / 8%);
}

.eyebrow {
  font-size: 22rpx;
  font-weight: 700;
  color: #4c6ef5;
  letter-spacing: 2rpx;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
  color: #1c1c3c;
}

.summary {
  font-size: 24rpx;
  color: #5f6480;
}

.panel {
  padding: 28rpx;
  margin-bottom: 28rpx;
  background: #fff;
  border-radius: 28rpx;
}

.step {
  display: flex;
  gap: 14rpx;
  align-items: flex-start;
}

.step + .step {
  margin-top: 18rpx;
}

.step-index {
  font-size: 28rpx;
  color: #4c6ef5;
}

.step-text {
  flex: 1;
  font-size: 26rpx;
  line-height: 1.6;
  color: #2f3555;
}

.back-btn {
  color: #fff;
  background: linear-gradient(135deg, #4c6ef5, #364fc7);
  border-radius: 999rpx;
}
</style>
