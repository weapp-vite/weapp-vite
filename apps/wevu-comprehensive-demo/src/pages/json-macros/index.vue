<script setup lang="ts">
import { ref } from 'wevu'

import JsonMacroCard from '../../components/json-macro-card/index.vue'
import { macroDemoNavBg, macroDemoNavTitle } from './macro.config'

definePageJson(async () => {
  const textStyle = macroDemoNavBg === '#0ea5e9' ? 'white' : 'black'
  return {
    navigationBarTitleText: macroDemoNavTitle,
    navigationBarBackgroundColor: macroDemoNavBg,
    navigationBarTextStyle: textStyle,
    enablePullDownRefresh: true,
  }
})

const counter = ref(0)
function inc() {
  counter.value += 1
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      JSON Macros
    </view>

    <view class="section">
      <view class="section-title">
        definePageJson（支持 import / 表达式 / async）
      </view>
      <view class="card">
        <text class="muted">
          Check emitted: dist/pages/json-macros/index.json
        </text>
        <button class="btn btn-primary" @click="inc">
          counter: {{ counter }}
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        defineComponentJson（组件级配置）
      </view>
      <JsonMacroCard />
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 32rpx;
}

.page-title {
  font-size: 44rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 32rpx;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgb(0 0 0 / 8%);
}

.section-title {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 24rpx;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
  line-height: 1.6;
}

.btn {
  padding: 24rpx 32rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
/* stylelint-enable order/properties-order */
</style>

