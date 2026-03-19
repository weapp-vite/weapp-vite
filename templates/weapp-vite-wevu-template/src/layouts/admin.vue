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
        {{ props.title || 'Admin Layout' }}
      </text>
      <text class="layout-admin__subtitle">
        {{ props.subtitle || '页面内容通过默认 slot 注入到布局中。' }}
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
    radial-gradient(circle at top right, rgb(37 99 235 / 18%), transparent 32%),
    linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
}

.layout-admin__hero {
  padding: 36rpx 32rpx 32rpx;
  color: #fff;
  background: linear-gradient(150deg, #0f172a 0%, #1d4ed8 62%, #60a5fa 100%);
  border-radius: 0 0 28rpx 28rpx;
  box-shadow: 0 18rpx 42rpx rgb(29 78 216 / 18%);
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
  font-size: 46rpx;
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
