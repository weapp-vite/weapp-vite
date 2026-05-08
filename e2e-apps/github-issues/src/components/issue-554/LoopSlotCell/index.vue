<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue554-cell" data-issue554-cell="true">
    <slot />
  </view>
</template>

<style scoped>
.issue554-cell {
  padding: 16rpx;
  background: #f8fafc;
  border: 2rpx solid #475569;
  border-radius: 8rpx;
}
</style>
