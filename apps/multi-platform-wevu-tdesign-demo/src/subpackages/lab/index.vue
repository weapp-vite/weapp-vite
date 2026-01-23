<script setup lang="ts">
import { computed, ref } from 'wevu'

import SectionTitle from '@/components/SectionTitle/index.vue'

definePageJson({
  navigationBarTitleText: '组件实验室',
  backgroundColor: '#f6f7fb',
})

const activeTab = ref('base')
const rating = ref(4)
const progress = ref(68)
const slider = ref(42)
const toggle = ref(true)

const progressValue = computed(() => (Number.isFinite(progress.value) ? progress.value : 0))

const tabs = [
  { value: 'base', label: '基础' },
  { value: 'feedback', label: '反馈' },
  { value: 'display', label: '展示' },
]

function navigateTo(url: string) {
  wx.navigateTo({
    url,
  })
}
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#f5f3ff] via-[#ffffff] to-[#eef2ff] p-[20rpx]">
      <SectionTitle title="TDesign 组件实验室" subtitle="常用组件的组合应用" />
      <view class="mt-[12rpx]">
        <t-tabs :value="activeTab" @change="(e) => (activeTab = e.detail.value)">
          <t-tab-panel v-for="tab in tabs" :key="tab.value" :value="tab.value" :label="tab.label" />
        </t-tabs>
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <view v-if="activeTab === 'base'" class="space-y-[14rpx]">
        <SectionTitle title="基础组件" subtitle="标签、徽标、头像" />
        <view class="flex flex-wrap gap-[10rpx]">
          <t-tag theme="primary" variant="light">
            新品
          </t-tag>
          <t-tag theme="warning" variant="light">
            加急
          </t-tag>
          <t-tag theme="success" variant="light">
            已完成
          </t-tag>
          <t-tag theme="default" variant="outline">
            低风险
          </t-tag>
        </view>
        <view class="flex items-center gap-[14rpx]">
          <t-badge count="8">
            <t-avatar size="small" shape="round">
              A
            </t-avatar>
          </t-badge>
          <t-badge count="new">
            <t-avatar size="small" shape="round">
              B
            </t-avatar>
          </t-badge>
          <t-avatar-group max="3" size="small">
            <t-avatar>U1</t-avatar>
            <t-avatar>U2</t-avatar>
            <t-avatar>U3</t-avatar>
            <t-avatar>U4</t-avatar>
          </t-avatar-group>
        </view>
        <view class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]">
          <SectionTitle title="Vue 模板语法" subtitle="class 绑定、对象/数组语法" />
          <view class="mt-[8rpx]">
            <t-cell-group>
              <t-cell title="Class 绑定实验室" note="子包：/subpackages/lab/class-binding" arrow @tap="navigateTo('/subpackages/lab/class-binding/index')" />
            </t-cell-group>
          </view>
        </view>
      </view>

      <view v-else-if="activeTab === 'feedback'" class="space-y-[14rpx]">
        <SectionTitle title="反馈组件" subtitle="进度、评分、滑块" />
        <t-progress :percentage="progressValue" status="active" stroke-width="8" />
        <view class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#6f6b8a]">
            满意度评分
          </text>
          <t-rate :value="rating" @change="(e) => (rating = e.detail.value)" />
        </view>
        <view class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#6f6b8a]">
            阈值调整
          </text>
          <view class="flex items-center gap-[12rpx]">
            <t-slider :value="slider" @change="(e) => (slider = e.detail.value)" />
            <text class="text-[22rpx] text-[#6f6b8a]">
              {{ slider }}%
            </text>
          </view>
        </view>
        <view class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#6f6b8a]">
            自动提醒
          </text>
          <t-switch :value="toggle" @change="(e) => (toggle = e.detail.value)" />
        </view>
      </view>

      <view v-else class="space-y-[14rpx]">
        <SectionTitle title="展示组件" subtitle="提示、轮播、二维码" />
        <t-notice-bar theme="info" content="TDesign 组件可用于丰富产品体验。" />
        <t-swiper :autoplay="true" height="140">
          <t-swiper-item>
            <view class="h-full rounded-[20rpx] bg-gradient-to-br from-[#c7d2fe] to-[#f0abfc] p-[16rpx]">
              <text class="text-[24rpx] font-semibold text-white">
                品牌展示
              </text>
              <text class="mt-[6rpx] block text-[20rpx] text-white/80">
                适合做活动横幅
              </text>
            </view>
          </t-swiper-item>
          <t-swiper-item>
            <view class="h-full rounded-[20rpx] bg-gradient-to-br from-[#fde68a] to-[#fca5a5] p-[16rpx]">
              <text class="text-[24rpx] font-semibold text-white">
                营销推荐
              </text>
              <text class="mt-[6rpx] block text-[20rpx] text-white/80">
                支持多色主题
              </text>
            </view>
          </t-swiper-item>
        </t-swiper>
        <view class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#6f6b8a]">
            扫码体验
          </text>
          <t-qrcode value="https://vite.icebreaker.top" size="90" />
        </view>
      </view>
    </view>
  </view>
</template>
