<script setup lang="ts">
import { computed } from 'wevu'

const emit = defineEmits<{
  (e: 'select', item: ActionItem): void
}>()

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  items: { type: null, default: () => [] },
}) as {
  title: string
  subtitle?: string
  items?: ActionItem[]
}

defineComponentJson({
  styleIsolation: 'apply-shared',
})

interface ActionItem {
  key: string
  title: string
  description?: string
  icon?: string
  tag?: string
  tone?: 'brand' | 'neutral'
  disabled?: boolean
  path?: string
  type?: 'tab' | 'sub'
}

const cards = computed(() => (Array.isArray(props.items) ? props.items : []))

function onSelect(item: ActionItem) {
  if (item.disabled) {
    return
  }
  emit('select', item)
}

function toneClass(tone?: 'brand' | 'neutral') {
  if (tone === 'brand') {
    return 'bg-[#eef2ff] text-[#3534a5]'
  }
  return 'bg-[#f2f4f8] text-[#5c5b7a]'
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
    </view>
    <view class="mt-[16rpx] grid grid-cols-2 gap-[12rpx]">
      <view
        v-for="item in cards"
        :key="item.key"
        class="rounded-[18rpx] bg-[#f7f7fb] p-[16rpx]"
        :class="item.disabled ? 'opacity-50' : 'opacity-100'"
        @tap="onSelect(item)"
      >
        <view class="flex items-center justify-between">
          <view class="flex items-center gap-[8rpx]">
            <view class="flex h-[36rpx] w-[36rpx] items-center justify-center rounded-[12rpx]" :class="toneClass(item.tone)">
              <t-icon :name="item.icon ?? 'app'" size="22" />
            </view>
            <text class="text-[24rpx] font-semibold text-[#1f1a3f]">
              {{ item.title }}
            </text>
          </view>
          <t-tag v-if="item.tag" size="small" theme="primary" variant="light">
            {{ item.tag }}
          </t-tag>
        </view>
        <text v-if="item.description" class="mt-[10rpx] block text-[20rpx] text-[#6f6b8a]">
          {{ item.description }}
        </text>
      </view>
    </view>
  </view>
</template>
