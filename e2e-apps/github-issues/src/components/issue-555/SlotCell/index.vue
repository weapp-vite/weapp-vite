<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue555-slot-cell">
    <view class="issue555-slot-cell__text" data-slot-text="host">
      <slot name="text" />
    </view>
  </view>
</template>

<style scoped>
.issue555-slot-cell {
  padding: 24rpx;
  background: #fff;
  border-radius: 12rpx;
}

.issue555-slot-cell__text {
  min-height: 40rpx;
  color: #0f172a;
}
</style>
