<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = defineProps<{
  title: string
  open: boolean
}>()

const slots = useSlots()

const slotKeys = computed(() => Object.keys(slots).sort())
const slotSummary = computed(() => {
  if (!slotKeys.value.length) {
    return '[]'
  }
  return JSON.stringify(slotKeys.value)
})
const openClassName = computed(() => (props.open ? 'slot-panel-open' : 'slot-panel-closed'))
const openText = computed(() => (props.open ? 'open' : 'closed'))
</script>

<template>
  <view class="use-slots-feature">
    <view class="use-slots-feature__title">
      {{ props.title }}
    </view>

    <view id="slots-panel" class="use-slots-feature__panel" :class="openClassName">
      panel: {{ openText }}
    </view>

    <view id="slots-summary" class="use-slots-feature__summary">
      slots: {{ slotSummary }}
    </view>

    <view v-if="props.open" class="use-slots-feature__content">
      <slot name="header" />
      <slot />
    </view>
  </view>
</template>

<style scoped>
.use-slots-feature {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 2rpx solid #cbd5e1;
  background: #fff;
}

.use-slots-feature__title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.use-slots-feature__panel {
  margin-top: 14rpx;
  padding: 10rpx 16rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.slot-panel-open {
  color: #047857;
  background: #dcfce7;
}

.slot-panel-closed {
  color: #991b1b;
  background: #fee2e2;
}

.use-slots-feature__summary {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #334155;
}

.use-slots-feature__content {
  margin-top: 12rpx;
  padding: 12rpx;
  border-radius: 10rpx;
  background: #f1f5f9;
}
</style>
