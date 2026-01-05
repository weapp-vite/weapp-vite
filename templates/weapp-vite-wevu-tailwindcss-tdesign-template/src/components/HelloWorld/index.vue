<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
  }>(),
  {
    title: 'Hello WeVU',
    subtitle: '',
  },
)
</script>

<template>
  <view class="rounded-[24rpx] bg-gradient-to-br from-[#4c6ef5] to-[#7048e8] p-[24rpx]">
    <text class="block text-[40rpx] font-bold text-white">
      {{ props.title }}
    </text>
    <text v-if="props.subtitle" class="mt-[8rpx] block text-[26rpx] text-white/85">
      {{ props.subtitle }}
    </text>
  </view>
</template>
