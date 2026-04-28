<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue521-scoped-flex-host" data-issue521-host="true">
    <slot :xyz="0" />
  </view>
</template>

<style scoped>
.issue521-scoped-flex-host {
  display: flex;
  flex-flow: row nowrap;
  gap: 16rpx;
  align-items: flex-start;
  padding: 20rpx;
  overflow: hidden;
  background: #fff;
  border: 2rpx solid #64748b;
  border-radius: 8rpx;
}
</style>
