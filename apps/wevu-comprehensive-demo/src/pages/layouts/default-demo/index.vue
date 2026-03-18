<script setup lang="ts">
const sections = [
  {
    title: '自动命中 default',
    desc: '当前页面没有声明 definePageMeta，因此自动使用 src/layouts/default.vue。',
  },
  {
    title: '适合作为基础外壳',
    desc: 'default 布局通常保持轻量，不强行改变全局视觉结构，便于逐步迁移老页面。',
  },
]

function backToLayouts() {
  wx.navigateTo({ url: '/pages/layouts/index' })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      默认布局示例
    </view>

    <view class="section">
      <view class="section-title">
        当前页面未声明 layout
      </view>
      <text class="summary">
        由于 `src/layouts/default.vue` 存在，这个页面会自动被包裹进默认布局组件。
      </text>
    </view>

    <view v-for="item in sections" :key="item.title" class="section">
      <view class="section-title">
        {{ item.title }}
      </view>
      <text class="summary">
        {{ item.desc }}
      </text>
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
.summary {
  display: block;
  font-size: 26rpx;
  line-height: 1.8;
  color: #475569;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "默认布局示例"
}
</json>
