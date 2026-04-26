<script setup lang="ts">
import { provide } from 'wevu'
import ProvideInjectScopeMiddle from '../../components/provide-inject-scope-middle/index.vue'

const PAGE_PROVIDE_SCOPE_KEY = 'wevu-features:page-provide-scope'

provide(PAGE_PROVIDE_SCOPE_KEY, 'page-provide-value')
</script>

<template>
  <view class="provide-inject-scope-page">
    <view class="provide-inject-scope-page__title">
      wevu provide / inject 深层作用域复现
    </view>
    <view id="scope-page-provider" class="provide-inject-scope-page__line">
      page provide = page-provide-value
    </view>
    <ProvideInjectScopeMiddle />
  </view>
</template>

<style scoped>
.provide-inject-scope-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #eef2ff;
}

.provide-inject-scope-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.provide-inject-scope-page__line {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #374151;
}
</style>
