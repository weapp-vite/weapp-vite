<script setup lang="ts">
defineOptions({
  name: 'UiTDesignQrcodePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-qrcode',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-qrcode
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-qrcode />
    </view>
  </view>
</template>

