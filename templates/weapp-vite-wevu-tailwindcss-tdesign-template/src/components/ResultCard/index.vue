<script setup lang="ts">
import { computed } from 'wevu'

defineOptions({
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(
  defineProps<{
    title: string
    items?: ResultItem[]
  }>(),
  {
    items: () => [],
  },
)

defineComponentJson({
  styleIsolation: 'apply-shared',
})

interface ResultItem {
  label: string
  value: string | number
}

const rows = computed(() => props.items ?? [])
</script>

<template>
  <view class="rounded-[20rpx] bg-white p-[20rpx] shadow-[0_12rpx_28rpx_rgba(17,24,39,0.08)]">
    <view class="flex items-center justify-between">
      <text class="text-[26rpx] font-semibold text-[#1f1a3f]">
        {{ title }}
      </text>
      <slot name="action" />
    </view>
    <view class="mt-[12rpx] space-y-[10rpx]">
      <view v-for="row in rows" :key="row.label" class="flex items-center justify-between">
        <text class="text-[22rpx] text-[#6f6b8a]">
          {{ row.label }}
        </text>
        <text class="text-[22rpx] font-semibold text-[#1f1a3f]">
          {{ row.value }}
        </text>
      </view>
    </view>
  </view>
</template>
