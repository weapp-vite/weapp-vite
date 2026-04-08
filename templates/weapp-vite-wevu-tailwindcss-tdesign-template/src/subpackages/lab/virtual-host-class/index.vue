<script setup lang="ts">
import BrokenCard from '@/components/VirtualHostClassDemo/BrokenCard.vue'
import FixedExternalClassCard from '@/components/VirtualHostClassDemo/FixedExternalClassCard.vue'
import RecommendedCard from '@/components/VirtualHostClassDemo/RecommendedCard.vue'

definePageJson({
  navigationBarTitleText: 'virtualHost class demo',
  backgroundColor: '#f6f7fb',
})

const classCase = 'rounded-[20rpx] border border-red-500 bg-red-50 px-[20rpx] py-[16rpx] text-red-500'
const inlineStyleCase = 'color:#2563eb;background:#dbeafe;padding:16rpx;border-radius:20rpx;border:2rpx solid #60a5fa;'
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#f5f3ff] via-[#ffffff] to-[#eef2ff] p-[20rpx]">
      <text class="text-[32rpx] font-semibold text-[#1f1a3f]">
        virtualHost + class/style 透传实验
      </text>
      <text class="mt-[10rpx] block text-[22rpx] leading-[1.7] text-[#5b5b7b]">
        当前模板已全局开启组件 `virtualHost: true` 和 `styleIsolation: 'apply-shared'`。本页用最小组件对比 4 种写法的实际效果。
      </text>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <text class="text-[28rpx] font-semibold text-[#1f1a3f]">
        1. 仅 `apply-shared`，不做 class 透传
      </text>
      <text class="mt-[8rpx] block text-[22rpx] leading-[1.7] text-[#6f6b8a]">
        组件标签上写 `class` / `style`，但组件内部根节点没有接收这些 attrs。
      </text>
      <view class="mt-[14rpx] flex flex-col gap-[14rpx]">
        <BrokenCard
          :class="classCase"
          title="BrokenCard"
          subtitle="预期应变红并出现红色边框，但实际不会。"
        />
        <BrokenCard
          :style="inlineStyleCase"
          title="BrokenCard style"
          subtitle="预期应变蓝并出现蓝色背景/边框，但实际不会。"
        />
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <text class="text-[28rpx] font-semibold text-[#1f1a3f]">
        2. `defineOptions({ externalClasses: ['class'] })`
      </text>
      <text class="mt-[8rpx] block text-[22rpx] leading-[1.7] text-[#6f6b8a]">
        这是你问的那种“继续用组件标签上的 `class`”方案。组件内部根节点必须显式写上 `class` 占位。
      </text>
      <view class="mt-[14rpx]">
        <FixedExternalClassCard
          :class="classCase"
          title="FixedExternalClassCard"
          subtitle="这一块应该会变红，并出现红色边框和浅红背景。"
        />
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <text class="text-[28rpx] font-semibold text-[#1f1a3f]">
        3. 推荐方案：`custom-class` + `rootStyle`
      </text>
      <text class="mt-[8rpx] block text-[22rpx] leading-[1.7] text-[#6f6b8a]">
        `class` 和 `style` 分开设计，避免把组件标签 attrs 是否透传这件事变成隐式行为。
      </text>
      <view class="mt-[14rpx] flex flex-col gap-[14rpx]">
        <RecommendedCard
          custom-class="rounded-[20rpx] border border-emerald-500 bg-emerald-50 px-[20rpx] py-[16rpx] text-emerald-600"
          title="RecommendedCard custom-class"
          subtitle="通过 externalClasses 显式接收类名。"
        />
        <RecommendedCard
          :root-style="inlineStyleCase"
          title="RecommendedCard rootStyle"
          subtitle="通过显式 prop 接收内联样式。"
        />
      </view>
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-[#1f1a3f] p-[20rpx] text-white">
      <text class="text-[26rpx] font-semibold">
        结论
      </text>
      <text class="mt-[10rpx] block text-[22rpx] leading-[1.8] text-white/80">
        `virtualHost: true` 和 `styleIsolation: 'apply-shared'` 不会自动提供 Vue 式根节点 `class/style` fallthrough。
        要么显式声明 `externalClasses` 并在根节点接入，要么把 `style` 做成显式 prop。
      </text>
    </view>
  </view>
</template>
