<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'TDesign 模板',
  backgroundColor: '#f6f7fb',
})

const count = ref(0)
const buttonText = computed(() => `已点击 ${count.value} 次`)
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] py-[32rpx] text-[#1f1a3f]">
    <view class="rounded-[28rpx] bg-white p-[28rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <t-tag theme="primary" variant="light">
        wevu
      </t-tag>
      <view class="mt-[16rpx] text-[38rpx] font-semibold">
        TDesign 最小模板
      </view>
      <view class="mt-[12rpx] text-[24rpx] leading-[1.6] text-[#64748b]">
        保留 Vue SFC、Tailwind CSS 与 TDesign 自动导入的最小组合，复杂验证场景已迁到 e2e-apps。
      </view>

      <view class="mt-[24rpx] rounded-[20rpx] bg-[#f4f6ff] p-[20rpx]">
        <text class="text-[24rpx] text-[#51517c]">
          {{ buttonText }}
        </text>
      </view>

      <t-button class="mt-[24rpx]" theme="primary" block @tap="count += 1">
        点一下
      </t-button>
    </view>
  </view>
</template>
