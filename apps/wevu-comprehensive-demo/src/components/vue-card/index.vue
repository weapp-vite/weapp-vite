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
  <view class="vue-card">
    <view class="vue-card__header">
      <slot name="header" v-bind="slotProps">
        <view v-if="props.badge" class="vue-card__badge">
          {{ props.badge }}
        </view>
        <view class="vue-card__titles">
          <text class="vue-card__title">
            {{ props.title }}
          </text>
          <text v-if="props.subtitle" class="vue-card__subtitle">
            {{ props.subtitle }}
          </text>
        </view>
      </slot>
    </view>
    <view class="vue-card__body">
      <slot v-bind="slotProps" />
    </view>
    <view v-if="$slots.footer" class="vue-card__footer">
      <slot name="footer" v-bind="slotProps" />
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.vue-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgb(0 0 0 / 6%);
}

.vue-card__header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.vue-card__badge {
  margin-right: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 22rpx;
}

.vue-card__titles {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.vue-card__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}

.vue-card__subtitle {
  font-size: 26rpx;
  color: #6b7280;
}

.vue-card__body {
  color: #374151;
  font-size: 26rpx;
  line-height: 1.6;
}

.vue-card__footer {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #e5e7eb;
  color: #4b5563;
  font-size: 24rpx;
  line-height: 1.5;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
