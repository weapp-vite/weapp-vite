<script setup lang="ts">
import { computed } from 'wevu'

defineOptions({
  options: {
    multipleSlots: true,
  },
})

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  items: { type: null, default: () => [] },
  columns: { type: Number, default: 2 },
}) as {
  title: string
  subtitle?: string
  items?: KpiItem[]
  columns?: 2 | 3
}

defineComponentJson({
  styleIsolation: 'apply-shared',
})

type KpiTone = 'positive' | 'negative' | 'neutral'

export interface KpiItem {
  key?: string
  label: string
  value: string | number
  unit?: string
  delta?: number
  footnote?: string
}

function resolveTone(delta?: number): KpiTone {
  if (delta === undefined || Number.isNaN(delta)) {
    return 'neutral'
  }
  if (delta > 0) {
    return 'positive'
  }
  if (delta < 0) {
    return 'negative'
  }
  return 'neutral'
}

const cards = computed(() => {
  const source = Array.isArray(props.items) ? props.items : []
  return source.map((item, index) => ({
    key: item.key ?? String(index),
    item,
    index,
    tone: resolveTone(item.delta),
    isLeading: index === 0,
  }))
})

const gridClass = computed(() => (props.columns === 3 ? 'grid-cols-3' : 'grid-cols-2'))

function formatDelta(delta?: number, unit = '') {
  if (delta === undefined || Number.isNaN(delta)) {
    return '--'
  }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}${unit}`
}

function toneBadgeClass(tone: KpiTone) {
  if (tone === 'positive') {
    return 'bg-[#e7f7ee] text-[#1b7a3a]'
  }
  if (tone === 'negative') {
    return 'bg-[#ffe9e9] text-[#b42318]'
  }
  return 'bg-[#edf1f7] text-[#64748b]'
}

function toneDotClass(tone: KpiTone) {
  if (tone === 'positive') {
    return 'bg-[#22c55e]'
  }
  if (tone === 'negative') {
    return 'bg-[#ef4444]'
  }
  return 'bg-[#94a3b8]'
}
</script>

<template>
  <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
    <view class="flex items-end justify-between">
      <view>
        <text class="text-[28rpx] font-semibold text-[#1f1a3f]">
          {{ title }}
        </text>
        <text v-if="subtitle" class="mt-[6rpx] block text-[22rpx] text-[#6f6b8a]">
          {{ subtitle }}
        </text>
      </view>
      <slot name="action" />
    </view>
    <view class="mt-[16rpx] grid gap-[12rpx]" :class="gridClass">
      <slot name="items" :items="cards">
        <view v-for="card in cards" :key="card.key">
          <view class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]">
            <view class="flex items-center justify-between">
              <view class="flex items-center gap-[8rpx]">
                <view class="h-[8rpx] w-[8rpx] rounded-full" :class="toneDotClass(card.tone)" />
                <text class="text-[22rpx] text-[#61618a]">
                  {{ card.item.label }}
                </text>
              </view>
              <view v-if="card.isLeading" class="rounded-full bg-[#fff3c2] px-[10rpx] py-[4rpx]">
                <text class="text-[18rpx] font-semibold text-[#8a5200]">
                  HOT
                </text>
              </view>
            </view>
            <view class="mt-[10rpx] flex items-end justify-between">
              <view class="flex items-baseline gap-[6rpx]">
                <text class="text-[32rpx] font-bold text-[#1c1c3c]">
                  {{ card.item.value }}
                </text>
                <text v-if="card.item.unit" class="text-[20rpx] text-[#7a7aa0]">
                  {{ card.item.unit }}
                </text>
              </view>
              <view class="rounded-full px-[10rpx] py-[4rpx]" :class="toneBadgeClass(card.tone)">
                <text class="text-[20rpx] font-semibold">
                  {{ card.tone === 'positive' ? '↑' : card.tone === 'negative' ? '↓' : '→' }}
                  {{ formatDelta(card.item.delta, card.item.unit ?? '') }}
                </text>
              </view>
            </view>
            <text v-if="card.item.footnote" class="mt-[6rpx] block text-[20rpx] text-[#8a8aa5]">
              {{ card.item.footnote }}
            </text>
          </view>
        </view>
      </slot>
    </view>
  </view>
</template>
