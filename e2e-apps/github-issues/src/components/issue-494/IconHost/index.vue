<script setup lang="ts">
</script>

<template>
  <view class="issue494-host">
    <slot name="icon" />
    <slot name="content" />
  </view>
</template>

<style scoped>
.issue494-host {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
</style>
