<script setup lang="ts">
defineOptions({
  name: 'UiTDesignColorPickerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-color-picker',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-color-picker
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-color-picker />
    </view>
  </view>
</template>
