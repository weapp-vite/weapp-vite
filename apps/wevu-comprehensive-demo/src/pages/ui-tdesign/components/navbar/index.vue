<script setup lang="ts">
defineOptions({
  name: 'UiTDesignNavbarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-navbar',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-navbar
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-navbar />
    </view>
  </view>
</template>

