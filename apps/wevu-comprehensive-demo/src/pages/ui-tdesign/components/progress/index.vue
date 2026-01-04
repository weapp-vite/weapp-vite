<script setup lang="ts">
defineOptions({
  name: 'UiTDesignProgressPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-progress',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-progress
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-progress />
    </view>
  </view>
</template>

