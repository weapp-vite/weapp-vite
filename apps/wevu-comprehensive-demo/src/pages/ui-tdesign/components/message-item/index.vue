<script setup lang="ts">
defineOptions({
  name: 'UiTDesignMessageItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-message-item',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-message-item
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-message id="t-message" />
      <t-message-item />
    </view>
  </view>
</template>
