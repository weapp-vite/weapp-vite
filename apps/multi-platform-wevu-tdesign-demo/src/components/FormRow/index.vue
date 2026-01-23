<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(
  defineProps<{
    label: string
    align?: 'left' | 'center' | 'right'
    description?: string
  }>(),
  {
    align: 'left',
    description: '',
  },
)

defineComponentJson({
  styleIsolation: 'apply-shared',
})

const labelClass = computed(() => {
  if (props.align === 'right') {
    return 'text-right'
  }
  if (props.align === 'center') {
    return 'text-center'
  }
  return 'text-left'
})
</script>

<template>
  <view class="flex flex-col gap-[8rpx]">
    <view class="flex items-baseline justify-between gap-[12rpx]">
      <text class="text-[22rpx] font-semibold text-[#1f1a3f]" :class="labelClass">
        {{ label }}
      </text>
      <text v-if="description" class="text-[20rpx] text-[#8a8aa5]">
        {{ description }}
      </text>
    </view>
    <slot />
  </view>
</template>
