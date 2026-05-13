<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="issue574-van-cell">
    <slot />
    <slot name="footer1" />
    <slot name="footer2" />
  </view>
</template>

<style scoped>
.issue574-van-cell {
  display: block;
  padding: 16rpx;
  background: #fff;
}
</style>
