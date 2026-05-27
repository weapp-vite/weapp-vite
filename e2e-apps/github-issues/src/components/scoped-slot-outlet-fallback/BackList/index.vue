<script setup lang="ts">
const back = {
  state: {
    list: ['alpha', 'beta'],
  },
}
</script>

<template>
  <view class="scoped-slot-outlet-fallback-back-list">
    <slot name="main" :list="back.state.list" />
    <slot name="footer" :list="back.state.list" />
  </view>
</template>

<style>
.scoped-slot-outlet-fallback-back-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
</style>
