<script setup lang="ts">
defineComponentJson({
  component: true,
  usingComponents: {
    't-message': 'tdesign-miniprogram/message/message',
    't-toast': 'tdesign-miniprogram/toast/toast',
  },
})
</script>

<template>
  <view class="layout-default">
    <view class="layout-default__bar">
      <text class="layout-default__label">
        default layout
      </text>
      <text class="layout-default__status">
        toast + message host
      </text>
    </view>
    <slot />
    <t-toast layout-host="layout-toast" />
    <t-message layout-host="layout-message" />
  </view>
</template>

<style>
.layout-default {
  min-height: 100%;
  background: #f5f7fb;
}

.layout-default__bar {
  display: flex;
  justify-content: space-between;
  padding: 18rpx 28rpx;
  color: #0f172a;
  background: #fff;
  border-bottom: 2rpx solid #e2e8f0;
}

.layout-default__label {
  font-size: 24rpx;
  font-weight: 700;
}

.layout-default__status {
  font-size: 22rpx;
  color: #64748b;
}
</style>
