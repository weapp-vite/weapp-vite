<script setup lang="ts">
import { bootstrapApp } from '@/bootstrap'

definePageJson({
  navigationBarTitleText: 'app vue hmr alias',
})

const pageLabel = 'APP-VUE-HMR-ALIAS-PAGE'
const pageBootstrapLabel = bootstrapApp()
</script>

<template>
  <view class="app-vue-hmr-alias-page">
    <text class="app-vue-hmr-alias-page__label">
      {{ pageLabel }}
    </text>
    <text class="app-vue-hmr-alias-page__bootstrap">
      {{ pageBootstrapLabel }}
    </text>
  </view>
</template>

<style>
.app-vue-hmr-alias-page {
  padding: 24rpx;
  font-size: 28rpx;
}

.app-vue-hmr-alias-page__bootstrap {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #475569;
}
</style>
