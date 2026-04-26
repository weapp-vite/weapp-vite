<script setup lang="ts">
import ProvideInjectScopeLevel01 from '../provide-inject-scope-level-01/index.vue'
</script>

<template>
  <view class="provide-inject-scope-middle">
    <view class="provide-inject-scope-middle__title">
      middle component
    </view>
    <ProvideInjectScopeLevel01 />
  </view>
</template>

<style scoped>
.provide-inject-scope-middle {
  padding: 18rpx;
  margin-top: 20rpx;
  background: #f8fafc;
  border: 2rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.provide-inject-scope-middle__title {
  font-size: 24rpx;
  font-weight: 600;
  color: #0f172a;
}
</style>
