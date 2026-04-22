<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue494-slot-host">
    <view class="issue494-slot-host__icon" data-slot-icon="host">
      <slot name="icon" />
    </view>
    <view class="issue494-slot-host__header" data-slot-header="host">
      <slot name="header" />
    </view>
    <view class="issue494-slot-host__content" data-slot-content="host">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.issue494-slot-host {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}

.issue494-slot-host__icon,
.issue494-slot-host__header,
.issue494-slot-host__content {
  padding: 12rpx;
  background: #f8fafc;
  border-radius: 12rpx;
}
</style>
