<script setup lang="ts">
defineOptions({
  name: 'Issue597Card',
})
</script>

<template>
  <view class="issue597-card">
    <slot name="header" />
  </view>
</template>

<style scoped>
.issue597-card {
  min-height: 64rpx;
  padding: 24rpx;
  border: 1px solid #d7dde8;
}
</style>
