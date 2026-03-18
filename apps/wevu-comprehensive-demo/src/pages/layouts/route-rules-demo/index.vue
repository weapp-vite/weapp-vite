<script setup lang="ts">
const facts = [
  '当前页面没有声明 definePageMeta().layout。',
  '默认布局来自 vite.config.ts 中的 weapp.routeRules。',
  '因此 routeRules 适合给一批页面提供统一的默认 layout。'
]

function backToLayouts() {
  wx.navigateTo({ url: '/pages/layouts/index' })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Route Rules 布局示例
    </view>

    <view class="section">
      <view class="section-title">
        由 weapp.routeRules 指定默认布局
      </view>
      <view v-for="fact in facts" :key="fact" class="fact-row">
        <text class="fact-row__bullet">
          •
        </text>
        <text class="fact-row__text">
          {{ fact }}
        </text>
      </view>
    </view>

    <view class="section">
      <button class="btn btn-primary" @tap="backToLayouts">
        返回布局总览
      </button>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.fact-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 14rpx;
}

.fact-row__bullet {
  color: #2563eb;
  font-size: 28rpx;
  line-height: 1.6;
}

.fact-row__text {
  flex: 1;
  font-size: 26rpx;
  line-height: 1.8;
  color: #334155;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Route Rules 布局示例"
}
</json>
