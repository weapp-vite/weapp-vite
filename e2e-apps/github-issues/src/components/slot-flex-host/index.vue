<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="slot-flex-host" data-slot-flex-host="true">
    <slot name="left" />
    <slot name="middle" />
    <slot name="right" />
  </view>
</template>

<style scoped>
.slot-flex-host {
  display: flex;
  flex-wrap: nowrap;
  gap: 12rpx;
  align-items: flex-start;
  padding: 16rpx;
  overflow: hidden;
  background: #fff;
  border-radius: 16rpx;
}
</style>
