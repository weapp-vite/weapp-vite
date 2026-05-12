<script setup lang="ts">
const label = 'scoped-default'
const count = 2
</script>

<template>
  <view class="issue558-default-scoped-cell">
    <slot
      :label="label"
      :count="count"
    />
  </view>
</template>

<style scoped>
.issue558-default-scoped-cell {
  padding: 20rpx;
  margin-top: 18rpx;
  background: #ecfdf5;
  border: 1rpx solid #86efac;
}
</style>
