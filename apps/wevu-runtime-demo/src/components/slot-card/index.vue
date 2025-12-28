<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  title: string
  subtitle?: string
  badge?: string
}>()

const slotProps = computed(() => ({
  title: props.title,
  subtitle: props.subtitle ?? '',
  badge: props.badge ?? '',
}))
</script>

<template>
  <view class="slot-card">
    <view class="slot-card__header">
      <slot name="header" v-bind="slotProps">
        <view v-if="props.badge" class="slot-card__badge">{{props.badge}}</view>
        <view class="slot-card__titles">
          <text class="slot-card__title">{{props.title}}</text>
          <text v-if="props.subtitle" class="slot-card__subtitle">{{props.subtitle}}</text>
        </view>
      </slot>
    </view>
    <view class="slot-card__body">
      <slot v-bind="slotProps" />
    </view>
    <view v-if="$slots.footer" class="slot-card__footer">
      <slot name="footer" v-bind="slotProps" />
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.slot-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
}

.slot-card__header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.slot-card__badge {
  margin-right: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
  color: #ffffff;
  font-size: 22rpx;
}

.slot-card__titles {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.slot-card__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #0f172a;
}

.slot-card__subtitle {
  font-size: 26rpx;
  color: #475569;
}

.slot-card__body {
  color: #1f2937;
  font-size: 26rpx;
  line-height: 1.5;
}

.slot-card__footer {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #e5e7eb;
  color: #6b7280;
  font-size: 24rpx;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "styleIsolation": "apply-shared"
}
</config>
