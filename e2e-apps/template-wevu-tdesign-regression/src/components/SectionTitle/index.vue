<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true,
  },
})

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
  }>(),
  {
    subtitle: '',
  },
)

defineComponentJson({
  styleIsolation: 'apply-shared',
})
</script>

<template>
  <view class="flex items-end justify-between">
    <view>
      <text class="text-[30rpx] font-semibold text-[#1f1a3f]">
        {{ title }}
      </text>
      <text v-if="subtitle" class="mt-[6rpx] block text-[22rpx] text-[#6f6b8a]">
        {{ subtitle }}
      </text>
    </view>
  </view>
</template>
