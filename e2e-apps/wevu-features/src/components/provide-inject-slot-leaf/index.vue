<script setup lang="ts">
import { inject } from 'wevu'

const SLOT_PROVIDE_SCOPE_KEY = 'wevu-features:slot-provide-scope'

const slotValue = inject(SLOT_PROVIDE_SCOPE_KEY, 'missing-slot')
</script>

<template>
  <view class="provide-inject-slot-leaf">
    <view id="scope-slot-value" class="provide-inject-slot-leaf__line">
      slot inject = {{ slotValue }}
    </view>
  </view>
</template>

<style scoped>
.provide-inject-slot-leaf {
  padding: 14rpx;
  margin-top: 12rpx;
  background: #f8fafc;
  border: 2rpx solid #e2e8f0;
  border-radius: 10rpx;
}

.provide-inject-slot-leaf__line {
  font-size: 24rpx;
  color: #334155;
}
</style>
