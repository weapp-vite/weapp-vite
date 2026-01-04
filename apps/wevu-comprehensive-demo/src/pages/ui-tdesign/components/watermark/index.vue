<script setup lang="ts">
defineOptions({
  name: 'UiTDesignWatermarkPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-watermark',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-watermark
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-watermark />
    </view>
  </view>
</template>
