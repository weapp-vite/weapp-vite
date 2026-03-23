<script setup lang="ts">
import { ref, setPageLayout } from 'wevu'

import SectionTitle from '@/components/SectionTitle/index.vue'
import { useToast } from '@/hooks/useToast'

definePageJson({
  navigationBarTitleText: '布局',
  backgroundColor: '#f6f7fb',
})

const { showToast } = useToast()
const currentLayout = ref<'default' | 'admin' | 'none'>('default')

const cards = [
  {
    key: 'default',
    title: 'default 布局',
    desc: '页面未声明 layout 时，会自动命中 src/layouts/default.vue。',
  },
  {
    key: 'admin',
    title: 'admin 布局',
    desc: '通过 setPageLayout(\'admin\') 切换到命名布局，并把 title/subtitle 作为 props 传给布局组件。',
  },
  {
    key: 'none',
    title: '关闭布局',
    desc: '通过 setPageLayout(false) 临时移除页面壳，用于沉浸式页或特殊根结构。',
  },
]

function applyDefaultLayout() {
  currentLayout.value = 'default'
  setPageLayout('default')
  showToast('已切回 default 布局')
}

function applyAdminLayout() {
  currentLayout.value = 'admin'
  setPageLayout('admin', {
    title: 'Studio Admin',
    subtitle: '这个标题来自 setPageLayout() 运行时传入的 props。',
  })
  showToast('已切换到 admin 布局')
}

function clearLayout() {
  currentLayout.value = 'none'
  setPageLayout(false)
  showToast('已关闭布局')
}

function openLayoutFeedbackDemo() {
  wx.navigateTo({
    url: '/pages/layout-feedback/index',
  })
}

function openLayoutStoreDemo() {
  wx.navigateTo({
    url: '/pages/layout-store/index',
  })
}
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#eef2ff] via-[#ffffff] to-[#ede9fe] p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.06)]">
      <SectionTitle title="页面布局能力" subtitle="基础模板已接入 src/layouts 目录约定" />
      <text class="mt-[12rpx] block text-[22rpx] leading-[1.7] text-[#5b5b7b]">
        当前状态：{{ currentLayout }}。可在 default、admin 与 false 三种模式之间切换，用来承接后台页、运营页或沉浸式页面。
      </text>
    </view>

    <view class="mt-[18rpx] flex flex-col gap-[14rpx]">
      <view
        v-for="item in cards"
        :key="item.key"
        class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]"
      >
        <text class="text-[28rpx] font-semibold text-[#1f1a3f]">
          {{ item.title }}
        </text>
        <text class="mt-[10rpx] block text-[22rpx] leading-[1.7] text-[#6f6b8a]">
          {{ item.desc }}
        </text>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="切换布局" subtitle="运行时调用 setPageLayout()" />
      <view class="mt-[14rpx] flex flex-col gap-[12rpx]">
        <t-button block theme="primary" @tap="applyDefaultLayout">
          使用 default 布局
        </t-button>
        <t-button block theme="primary" variant="outline" @tap="applyAdminLayout">
          切到 admin 布局
        </t-button>
        <t-button block theme="danger" variant="outline" @tap="clearLayout">
          关闭布局
        </t-button>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="通信演示" subtitle="查看页面/组件如何直接使用 layout 里的反馈宿主" />
      <text class="mt-[12rpx] block text-[22rpx] leading-[1.7] text-[#6f6b8a]">
        演示页会同时展示页面调用和子组件调用，它们都只依赖 useToast() / useDialog()，不会直接操作 layout 实例。
      </text>
      <t-button class="mt-[16rpx]" block theme="primary" variant="outline" @tap="openLayoutFeedbackDemo">
        打开 Layout 通信演示
      </t-button>
      <t-button class="mt-[12rpx]" block theme="primary" variant="outline" @tap="openLayoutStoreDemo">
        打开 Store 驱动 Layout 演示
      </t-button>
    </view>
  </view>
</template>
