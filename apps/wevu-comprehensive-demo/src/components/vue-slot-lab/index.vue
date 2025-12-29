<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  badge?: string
}>(), {
  title: 'Slot Lab',
  subtitle: '默认 / 具名 / 作用域 / 动态插槽覆盖',
  badge: 'slot',
})

const slotPayload = {
  now: () => new Date().toLocaleTimeString(),
  items: [
    { id: 1, name: 'alpha' },
    { id: 2, name: 'beta' },
    { id: 3, name: 'gamma' },
  ],
}
</script>

<template>
  <view class="card">
    <view class="head">
      <view class="head-left">
        <text class="title">
          {{ props.title }}
        </text>
        <text class="subtitle">
          {{ props.subtitle }}
        </text>
      </view>
      <text class="badge">
        {{ props.badge }}
      </text>
    </view>

    <view class="body">
      <slot name="header">
        <text class="fallback">
          未提供 #header，显示 fallback
        </text>
      </slot>

      <slot :items="slotPayload.items" :now="slotPayload.now">
        <text class="fallback">
          未提供默认插槽，显示 fallback
        </text>
      </slot>

      <slot name="footer" :time="slotPayload.now()">
        <text class="fallback">
          未提供 #footer，显示 fallback
        </text>
      </slot>
    </view>
  </view>
</template>

<style scoped>
/* stylelint-disable order/properties-order */
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.head-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  display: block;
  font-size: 24rpx;
  color: #475569;
}

.badge {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 22rpx;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #e2e8f0;
}

.fallback {
  display: block;
  font-size: 24rpx;
  color: #64748b;
}
/* stylelint-enable order/properties-order */
</style>
