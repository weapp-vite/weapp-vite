<script setup lang="ts">
import { computed } from 'wevu'

const sidebarEnabled = computed(() => true)
const layoutTitle = computed(() => 'Dashboard')

definePageMeta({
  layout: {
    name: 'admin',
    props: {
      sidebar: sidebarEnabled.value,
      title: layoutTitle.value,
    },
  },
})

const panels = [
  {
    title: '命名布局 + props',
    desc: '这个页面通过 definePageMeta({ layout: { name: \'admin\', props } }) 切到 admin 布局，并把 computed/ref 派生值作为 props 传给布局组件。',
  },
  {
    title: 'slot 承载页面内容',
    desc: '你现在看到的页面主体，并不是 layout 自己写死的，而是当前页面模板通过默认 slot 插进去的。',
  },
]

function backToLayouts() {
  wx.navigateTo({ url: '/pages/layouts/index' })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Admin 布局示例
    </view>

    <view v-for="panel in panels" :key="panel.title" class="section">
      <view class="section-title">
        {{ panel.title }}
      </view>
      <text class="body-text">
        {{ panel.desc }}
      </text>
    </view>

    <view class="section stat-grid">
      <view class="stat">
        <text class="stat__value">
          Dashboard
        </text>
        <text class="stat__label">
          layout.props.title
        </text>
      </view>
      <view class="stat">
        <text class="stat__value">
          true
        </text>
        <text class="stat__label">
          layout.props.sidebar
        </text>
      </view>
    </view>

    <view class="section">
      <button class="btn btn-success" @tap="backToLayouts">
        返回布局总览
      </button>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.body-text {
  display: block;
  font-size: 26rpx;
  line-height: 1.8;
  color: #334155;
}

.stat-grid {
  display: flex;
  gap: 16rpx;
}

.stat {
  flex: 1;
  padding: 22rpx;
  border-radius: 16rpx;
  background: #f0fdf4;
}

.stat__value {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #166534;
}

.stat__label {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #4b5563;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Admin 布局示例"
}
</json>
