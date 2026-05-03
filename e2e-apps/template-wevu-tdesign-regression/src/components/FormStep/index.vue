<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true,
  },
})

withDefaults(
  defineProps<{
    step: number
    title: string
    subtitle?: string
    active?: boolean
  }>(),
  {
    subtitle: '',
    active: false,
  },
)

defineComponentJson({
  styleIsolation: 'apply-shared',
})
</script>

<template>
  <view class="rounded-[20rpx] bg-white p-[20rpx] shadow-[0_12rpx_28rpx_rgba(17,24,39,0.08)]">
    <view class="flex items-center gap-[12rpx]">
      <view
        class="flex h-[36rpx] w-[36rpx] items-center justify-center rounded-full text-[20rpx] font-semibold"
        :class="active ? 'bg-[#2f2b5f] text-white' : 'bg-[#eff1f6] text-[#5c5b7a]'"
      >
        {{ step }}
      </view>
      <view>
        <text class="text-[26rpx] font-semibold text-[#1f1a3f]">
          {{ title }}
        </text>
        <text v-if="subtitle" class="mt-[4rpx] block text-[20rpx] text-[#6f6b8a]">
          {{ subtitle }}
        </text>
      </view>
    </view>
    <view class="mt-[16rpx]">
      <slot />
    </view>
  </view>
</template>
