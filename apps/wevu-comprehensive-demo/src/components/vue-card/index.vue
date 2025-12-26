<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
  badge?: string
}>()
</script>

<template>
  <view class="vue-card">
    <view class="vue-card__header">
      <view v-if="props.badge" class="vue-card__badge">{{props.badge}}</view>
      <view class="vue-card__titles">
        <text class="vue-card__title">{{props.title}}</text>
        <text v-if="props.subtitle" class="vue-card__subtitle">{{props.subtitle}}</text>
      </view>
    </view>
    <view class="vue-card__body">
      <slot />
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.vue-card {
  background: #ffffff;
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
  color: #ffffff;
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
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "styleIsolation": "apply-shared"
}
</config>
