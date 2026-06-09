<script setup lang="ts">
import { ref, setPageLayout } from 'wevu'

import { useLayoutFeedback } from '@/hooks/useLayoutFeedback'

definePageJson({
  navigationBarTitleText: 'Wevu 布局能力',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-tag': 'tdesign-miniprogram/tag/tag',
  },
})

definePageMeta({
  layout: 'default',
})

const currentLayout = ref<'default' | 'compact' | 'none'>('default')
const { showMessage, showToast } = useLayoutFeedback()

const layoutRows = [
  { title: 'default', note: '轻量顶栏 + TDesign 反馈宿主' },
  { title: 'compact', note: '带头图的 SFC layout + props' },
  { title: 'none', note: '运行时关闭 layout 包裹' },
]

function useDefaultLayout() {
  currentLayout.value = 'default'
  setPageLayout('default')
  showToast('已切回 default layout')
}

function useCompactLayout() {
  currentLayout.value = 'compact'
  setPageLayout('compact', {
    title: 'Donut Wevu Compact Layout',
    subtitle: '这个标题来自 SFC 页面运行时 setPageLayout()。',
  })
  showMessage('已切换到 compact layout', 'success')
}

function closeLayout() {
  currentLayout.value = 'none'
  setPageLayout(false)
  wx.showToast({
    title: 'layout 已关闭',
    icon: 'none',
  })
}

function showToastFromLayout() {
  showToast(`当前布局：${currentLayout.value}`)
}

function showMessageFromLayout() {
  showMessage(`来自 layout 内 t-message：${currentLayout.value}`)
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="eyebrow">
        LAYOUTS
      </view>
      <view class="title">
        SFC Layout 切换
      </view>
      <view class="subtitle">
        当前布局：{{ currentLayout }}。页面按钮会调用 layout 内的 t-toast 和 t-message。
      </view>
      <view class="tags">
        <t-tag theme="primary" variant="light">
          setPageLayout
        </t-tag>
        <t-tag theme="success" variant="light">
          t-toast
        </t-tag>
        <t-tag theme="warning" variant="light">
          t-message
        </t-tag>
      </view>
    </view>

    <view class="panel">
      <view class="panel-title">
        布局列表
      </view>
      <t-cell-group>
        <t-cell
          v-for="row in layoutRows"
          :key="row.title"
          :title="row.title"
          :note="row.note"
        />
      </t-cell-group>
    </view>

    <view class="actions">
      <t-button theme="primary" block @tap="useDefaultLayout">
        使用 default layout
      </t-button>
      <t-button theme="primary" variant="outline" block @tap="useCompactLayout">
        切换 compact layout
      </t-button>
      <t-button theme="danger" variant="outline" block @tap="closeLayout">
        关闭 layout
      </t-button>
      <t-button theme="success" variant="outline" block @tap="showToastFromLayout">
        调用 layout Toast
      </t-button>
      <t-button theme="default" variant="outline" block @tap="showMessageFromLayout">
        调用 layout Message
      </t-button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  color: #172033;
}

.header,
.panel {
  padding: 26rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.eyebrow {
  font-size: 22rpx;
  font-weight: 700;
  color: #0f766e;
}

.title {
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 700;
}

.subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #64748b;
}

.tags,
.actions {
  display: flex;
  gap: 14rpx;
}

.tags {
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.panel,
.actions {
  margin-top: 22rpx;
}

.panel-title {
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.actions {
  flex-direction: column;
}
</style>
