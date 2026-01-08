<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(
  defineProps<{
    title: string
    value: string | number
    unit?: string
    delta?: number
    progress?: number
  }>(),
  {
    unit: '',
    delta: undefined,
    progress: undefined,
  },
)

defineComponentJson({
  styleIsolation: 'apply-shared',
})

type TrendTone = 'positive' | 'negative' | 'neutral'

const tone = computed<TrendTone>(() => {
  if (props.delta === undefined || Number.isNaN(props.delta)) {
    return 'neutral'
  }
  if (props.delta > 0) {
    return 'positive'
  }
  if (props.delta < 0) {
    return 'negative'
  }
  return 'neutral'
})

const progressValue = computed(() => {
  if (props.progress === undefined || Number.isNaN(props.progress)) {
    return 0
  }
  return Math.min(Math.max(props.progress, 0), 100)
})

function toneText(toneValue: TrendTone) {
  if (toneValue === 'positive') {
    return '↑'
  }
  if (toneValue === 'negative') {
    return '↓'
  }
  return '→'
}

function toneClass(toneValue: TrendTone) {
  if (toneValue === 'positive') {
    return 'text-[#1b7a3a]'
  }
  if (toneValue === 'negative') {
    return 'text-[#b42318]'
  }
  return 'text-[#64748b]'
}
</script>

<template>
  <view class="rounded-[20rpx] bg-white p-[18rpx] shadow-[0_12rpx_28rpx_rgba(17,24,39,0.08)]">
    <view class="flex items-center justify-between">
      <text class="text-[24rpx] text-[#5b5876]">
        {{ title }}
      </text>
      <text class="text-[20rpx]" :class="toneClass(tone)">
        {{ toneText(tone) }}
        {{ delta === undefined ? '--' : delta }}
      </text>
    </view>
    <view class="mt-[12rpx] flex items-baseline gap-[6rpx]">
      <text class="text-[36rpx] font-bold text-[#1f1a3f]">
        {{ value }}
      </text>
      <text v-if="unit" class="text-[20rpx] text-[#7a7aa0]">
        {{ unit }}
      </text>
    </view>
    <t-progress
      v-if="progress !== undefined"
      class="mt-[12rpx]"
      :percentage="progressValue"
      status="active"
      stroke-width="6"
    />
  </view>
</template>
