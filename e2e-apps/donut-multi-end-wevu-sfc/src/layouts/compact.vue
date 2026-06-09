<script setup lang="ts">
const props = defineProps<{
  subtitle?: string
  title?: string
}>()

defineComponentJson({
  component: true,
  usingComponents: {
    't-message': 'tdesign-miniprogram/message/message',
    't-toast': 'tdesign-miniprogram/toast/toast',
  },
})
</script>

<template>
  <view class="layout-compact">
    <view class="layout-compact__hero">
      <text class="layout-compact__eyebrow">
        compact layout
      </text>
      <text class="layout-compact__title">
        {{ props.title || 'Donut Wevu Layout Console' }}
      </text>
      <text class="layout-compact__subtitle">
        {{ props.subtitle || '运行时可切换的 SFC layout，内置 TDesign 反馈宿主。' }}
      </text>
    </view>
    <view class="layout-compact__body">
      <slot />
    </view>
    <t-toast layout-host="layout-toast" />
    <t-message layout-host="layout-message" />
  </view>
</template>

<style>
.layout-compact {
  min-height: 100%;
  background: linear-gradient(180deg, #f0fdfa 0%, #eff6ff 100%);
}

.layout-compact__hero {
  display: flex;
  flex-direction: column;
  padding: 34rpx 32rpx 30rpx;
  color: #fff;
  background: linear-gradient(135deg, #0f766e, #2563eb);
  border-radius: 0 0 28rpx 28rpx;
}

.layout-compact__eyebrow {
  font-size: 22rpx;
  font-weight: 700;
}

.layout-compact__title {
  margin-top: 12rpx;
  font-size: 40rpx;
  font-weight: 700;
}

.layout-compact__subtitle {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgb(255 255 255 / 86%);
}

.layout-compact__body {
  padding-bottom: 28rpx;
}
</style>
