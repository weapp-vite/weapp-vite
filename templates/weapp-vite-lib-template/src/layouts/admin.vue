<script setup lang="ts">
const props = defineProps<{
  subtitle?: string
  title?: string
}>()
</script>

<template>
  <view class="layout-admin">
    <view class="layout-admin__hero">
      <text class="layout-admin__eyebrow">
        layouts/admin.vue
      </text>
      <text class="layout-admin__title">
        {{ props.title || 'Library Admin Layout' }}
      </text>
      <text class="layout-admin__subtitle">
        {{ props.subtitle || '原生 Page 模板也可以通过 setPageLayout() 切换布局。' }}
      </text>
    </view>
    <view class="layout-admin__body">
      <slot />
    </view>
  </view>
</template>

<style>
.layout-admin {
  min-height: 100%;
  background:
    radial-gradient(circle at top right, rgb(15 23 42 / 16%), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
}

.layout-admin__hero {
  padding: 36rpx 32rpx 32rpx;
  color: #fff;
  background: linear-gradient(145deg, #0f172a 0%, #2563eb 64%, #60a5fa 100%);
  border-radius: 0 0 28rpx 28rpx;
  box-shadow: 0 18rpx 42rpx rgb(37 99 235 / 16%);
}

.layout-admin__eyebrow {
  display: inline-flex;
  padding: 8rpx 16rpx;
  font-size: 22rpx;
  background: rgb(255 255 255 / 14%);
  border-radius: 999rpx;
}

.layout-admin__title {
  display: block;
  margin-top: 18rpx;
  font-size: 44rpx;
  font-weight: 700;
}

.layout-admin__subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  opacity: 0.92;
}

.layout-admin__body {
  padding-bottom: 32rpx;
}
</style>

<json>
{
  "component": true
}
</json>
