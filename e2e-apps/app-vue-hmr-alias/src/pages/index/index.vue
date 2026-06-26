<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'app vue hmr alias',
})

const pageLabel = 'APP-VUE-HMR-ALIAS-PAGE'
</script>

<template>
  <view class="app-vue-hmr-alias-page">
    <text>{{ pageLabel }}</text>
  </view>
</template>

<style>
.app-vue-hmr-alias-page {
  padding: 24rpx;
  font-size: 28rpx;
}
</style>
