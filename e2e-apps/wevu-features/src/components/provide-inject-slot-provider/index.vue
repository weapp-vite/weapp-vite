<script setup lang="ts">
import { provide } from 'wevu'

const SLOT_PROVIDE_SCOPE_KEY = 'wevu-features:slot-provide-scope'

provide(SLOT_PROVIDE_SCOPE_KEY, 'slot-provider-value')
</script>

<template>
  <view class="provide-inject-slot-provider">
    <view id="scope-slot-provider" class="provide-inject-slot-provider__line">
      slot provider = slot-provider-value
    </view>
    <slot />
  </view>
</template>

<style scoped>
.provide-inject-slot-provider {
  padding: 18rpx;
  margin-top: 16rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.provide-inject-slot-provider__line {
  font-size: 24rpx;
  color: #334155;
}
</style>
