<script setup lang="ts">
import { computed, inject } from 'wevu'

const APP_PROVIDE_SCOPE_KEY = 'wevu-features:app-provide-scope'
const PAGE_PROVIDE_SCOPE_KEY = 'wevu-features:page-provide-scope'

const appValue = inject(APP_PROVIDE_SCOPE_KEY, 'missing-app')
const pageValue = inject(PAGE_PROVIDE_SCOPE_KEY, 'missing-page')

const summaryText = computed(() => `app=${appValue}; page=${pageValue}`)
</script>

<template>
  <view class="provide-inject-scope-leaf">
    <view id="scope-app-value" class="provide-inject-scope-leaf__line">
      app inject = {{ appValue }}
    </view>
    <view id="scope-page-value" class="provide-inject-scope-leaf__line">
      page inject = {{ pageValue }}
    </view>
    <view id="scope-summary" class="provide-inject-scope-leaf__summary">
      {{ summaryText }}
    </view>
  </view>
</template>

<style scoped>
.provide-inject-scope-leaf {
  padding: 18rpx;
  margin-top: 16rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.provide-inject-scope-leaf__line {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #334155;
}

.provide-inject-scope-leaf__summary {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}
</style>
