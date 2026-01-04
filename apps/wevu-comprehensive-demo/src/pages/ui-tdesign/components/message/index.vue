<script setup lang="ts">
defineOptions({
  name: 'UiTDesignMessagePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-message',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-message
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-message id="t-message" />
    </view>
  </view>
</template>
