<script setup lang="ts">
defineOptions({
  name: 'UiTDesignInputPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-input',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-input
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-input />
    </view>
  </view>
</template>

