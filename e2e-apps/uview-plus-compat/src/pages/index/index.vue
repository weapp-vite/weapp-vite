<script setup lang="ts">
import { componentScenarios } from '../../scenarios'

definePageJson({ navigationBarTitleText: 'uview-plus components' })

function open(route: string) {
  uni.navigateTo({ url: route })
}
</script>

<template>
  <view class="index-page">
    <view class="index-title">uview-plus 3.8.86</view>
    <view class="index-summary">{{ componentScenarios.length }} component scenarios</view>
    <view
      v-for="scenario in componentScenarios"
      :key="scenario.component"
      class="index-row"
      @tap="open(scenario.route)"
    >
      <text>{{ scenario.component }}</text>
      <text class="index-arrow">›</text>
    </view>
  </view>
</template>

<style>
.index-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
}

.index-title {
  font-size: 38rpx;
  font-weight: 700;
}

.index-summary {
  margin: 8rpx 0 20rpx;
  color: #5f6670;
}

.index-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  padding: 0 20rpx;
  margin-top: 8rpx;
  background: #fff;
  border: 2rpx solid #e1e4e8;
  border-radius: 8rpx;
}

.index-arrow {
  color: #1769e0;
}
</style>
