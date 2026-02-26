<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  title: string
  subtitle?: string
  badge?: string
}>()

defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
})

const subtitleText = computed(() => props.subtitle ?? '')
</script>

<template>
  <view class="native-card">
    <view class="native-card__head">
      <text class="native-card__title">
        {{ props.title }}
      </text>
      <text v-if="props.badge" class="native-card__badge">
        badge: {{ props.badge }}
      </text>
    </view>
    <text v-if="subtitleText" class="native-card__subtitle">
      {{ subtitleText }}
    </text>
    <view class="native-card__body">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.native-card {
  padding: 18rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 14rpx;
}

.native-card__head {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.native-card__title {
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.native-card__badge {
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  color: #155e75;
  background: #cffafe;
  border-radius: 9999rpx;
}

.native-card__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.native-card__body {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #334155;
}
</style>
