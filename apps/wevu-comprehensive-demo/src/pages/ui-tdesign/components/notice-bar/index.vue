<script setup lang="ts">
defineOptions({
  name: 'UiTDesignNoticeBarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-notice-bar',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-notice-bar
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-notice-bar />
    </view>
  </view>
</template>
