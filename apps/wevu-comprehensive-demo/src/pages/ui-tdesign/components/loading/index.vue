<script setup lang="ts">
defineOptions({
  name: 'UiTDesignLoadingPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-loading',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-loading
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-loading />
    </view>
  </view>
</template>
