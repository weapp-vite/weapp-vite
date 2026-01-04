<script setup lang="ts">
defineOptions({
  name: 'UiTDesignScrollViewPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-scroll-view',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-scroll-view
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-scroll-view />
    </view>
  </view>
</template>
