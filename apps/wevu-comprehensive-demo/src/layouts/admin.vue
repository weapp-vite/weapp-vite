<script setup lang="ts">
const props = defineProps<{
  sidebar?: boolean
  title?: string
}>()
</script>

<template>
  <view class="admin-layout">
    <view class="admin-layout__hero">
      <text class="admin-layout__eyebrow">
        layouts/admin.vue
      </text>
      <text class="admin-layout__title">
        {{ props.title || 'Admin Layout' }}
      </text>
      <text class="admin-layout__subtitle">
        页面内容通过默认 slot 注入到这个布局里。
      </text>
    </view>
    <view v-if="props.sidebar" class="admin-layout__toolbar">
      <text class="admin-layout__toolbar-badge">
        sidebar=true
      </text>
      <text class="admin-layout__toolbar-text">
        这个标记来自 definePageMeta().layout.props
      </text>
    </view>
    <view class="admin-layout__body">
      <slot />
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.admin-layout {
  min-height: 100%;
  background:
    radial-gradient(circle at top right, rgb(34 197 94 / 18%), transparent 32%),
    linear-gradient(180deg, #f8fffb 0%, #eefbf3 100%);
}

.admin-layout__hero {
  padding: 36rpx 32rpx 32rpx;
  background: linear-gradient(135deg, #14532d 0%, #166534 58%, #22c55e 100%);
  color: #fff;
  border-radius: 0 0 28rpx 28rpx;
  box-shadow: 0 16rpx 36rpx rgb(22 101 52 / 18%);
}

.admin-layout__eyebrow {
  display: inline-flex;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: rgb(255 255 255 / 14%);
}

.admin-layout__title {
  display: block;
  margin-top: 18rpx;
  font-size: 48rpx;
  font-weight: 700;
}

.admin-layout__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.7;
  opacity: 0.92;
}

.admin-layout__body {
  padding-bottom: 32rpx;
}

.admin-layout__toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 24rpx 24rpx 0;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: rgb(20 83 45 / 8%);
  color: #14532d;
}

.admin-layout__toolbar-badge {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: rgb(20 83 45 / 12%);
  font-size: 20rpx;
  font-weight: 600;
}

.admin-layout__toolbar-text {
  flex: 1;
  font-size: 22rpx;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "component": true
}
</json>
