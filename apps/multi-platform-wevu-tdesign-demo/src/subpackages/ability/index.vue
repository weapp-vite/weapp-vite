<script setup lang="ts">
import { computed, onShow, ref } from 'wevu'

import SectionTitle from '@/components/SectionTitle/index.vue'

definePageJson({
  navigationBarTitleText: 'API 场景',
  backgroundColor: '#f6f7fb',
})

const systemInfo = ref<WechatMiniprogram.SystemInfo | null>(null)

const infoRows = computed(() => {
  const info = systemInfo.value
  return [
    { label: '机型', value: info?.model ?? '--' },
    { label: '系统', value: info ? `${info.system}` : '--' },
    { label: '版本', value: info?.version ?? '--' },
    { label: '基础库', value: info?.SDKVersion ?? '--' },
  ]
})

const layoutRows = computed(() => {
  const info = systemInfo.value
  if (!info) {
    return []
  }
  return [
    { label: '屏幕宽度', value: `${info.windowWidth}px` },
    { label: '屏幕高度', value: `${info.windowHeight}px` },
    { label: '状态栏', value: `${info.statusBarHeight}px` },
  ]
})

function loadSystemInfo() {
  wx.getSystemInfo({
    success: (result) => {
      systemInfo.value = result
    },
  })
}

onShow(() => {
  loadSystemInfo()
})
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#ecfccb] via-[#ffffff] to-[#d9f99d] p-[20rpx]">
      <SectionTitle title="系统信息" subtitle="使用原生 API 获取设备信息" />
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="设备概览" subtitle="基础信息卡片" />
      <view class="mt-[12rpx] space-y-[10rpx]">
        <view v-for="row in infoRows" :key="row.label" class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#6f6b8a]">
            {{ row.label }}
          </text>
          <text class="text-[22rpx] font-semibold text-[#1f1a3f]">
            {{ row.value }}
          </text>
        </view>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="布局信息" subtitle="适配屏幕尺寸" />
      <view class="mt-[12rpx] space-y-[10rpx]">
        <view v-for="row in layoutRows" :key="row.label" class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#6f6b8a]">
            {{ row.label }}
          </text>
          <text class="text-[22rpx] font-semibold text-[#1f1a3f]">
            {{ row.value }}
          </text>
        </view>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="构建提示" subtitle="weapp-vite 特性" />
      <view class="mt-[12rpx] space-y-[10rpx]">
        <view class="flex items-center gap-[8rpx]">
          <view class="h-[8rpx] w-[8rpx] rounded-full bg-[#2f2b5f]" />
          <text class="text-[22rpx] text-[#4c4b68]">
            子包页面按需加载，降低首包压力
          </text>
        </view>
        <view class="flex items-center gap-[8rpx]">
          <view class="h-[8rpx] w-[8rpx] rounded-full bg-[#2f2b5f]" />
          <text class="text-[22rpx] text-[#4c4b68]">
            组件与页面使用 alias 路径统一管理
          </text>
        </view>
        <view class="flex items-center gap-[8rpx]">
          <view class="h-[8rpx] w-[8rpx] rounded-full bg-[#2f2b5f]" />
          <text class="text-[22rpx] text-[#4c4b68]">
            全局样式隔离使用 apply-shared
          </text>
        </view>
      </view>
    </view>
  </view>
</template>
