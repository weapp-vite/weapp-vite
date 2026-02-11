<script setup lang="ts">
const root = {
  a: 'aaaa',
}
</script>

<template>
  <view class="root-class-box">
    <view v-if="root" :class="root.a">
      root class: {{ root.a }}
    </view>
  </view>
</template>

<style scoped>
.root-class-box {
  margin-top: 20rpx;
}

.aaaa {
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #155e75;
  background: #cffafe;
}
</style>
