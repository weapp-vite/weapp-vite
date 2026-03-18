<script setup lang="ts">
definePageMeta({
  layout: false,
})

const notes = [
  '当前页面显式关闭了默认布局。',
  '即使 src/layouts/default.vue 存在，也不会再自动包裹页面模板。',
  '适合极简落地页、沉浸式页面或需要完全自定义根结构的场景。',
]

function backToLayouts() {
  wx.navigateTo({ url: '/pages/layouts/index' })
}
</script>

<template>
  <view class="container no-layout-page">
    <view class="page-title">
      关闭布局示例
    </view>

    <view class="section">
      <view class="section-title">
        definePageMeta({ layout: false })
      </view>
      <view v-for="note in notes" :key="note" class="note-row">
        <text class="note-row__bullet">
          •
        </text>
        <text class="note-row__text">
          {{ note }}
        </text>
      </view>
    </view>

    <view class="section no-layout-page__banner">
      <text class="no-layout-page__banner-title">
        当前根节点就是页面本身
      </text>
      <text class="no-layout-page__banner-desc">
        这个页面不会被 default/admin/native-shell 任何布局包裹。
      </text>
    </view>

    <view class="section">
      <button class="btn btn-warning" @tap="backToLayouts">
        返回布局总览
      </button>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.no-layout-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgb(249 115 22 / 12%), transparent 28%),
    linear-gradient(180deg, #fffaf5 0%, #fff7ed 100%);
}

.note-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 14rpx;
}

.note-row__bullet {
  color: #ea580c;
  font-size: 28rpx;
  line-height: 1.6;
}

.note-row__text {
  flex: 1;
  font-size: 26rpx;
  line-height: 1.8;
  color: #7c2d12;
}

.no-layout-page__banner {
  background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
}

.no-layout-page__banner-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #9a3412;
}

.no-layout-page__banner-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #7c2d12;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "关闭布局示例"
}
</json>
