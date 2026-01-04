<script setup lang="ts">
defineOptions({
  name: 'UiTDesignDateTimePickerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-date-time-picker',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-date-time-picker
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-date-time-picker />
    </view>
  </view>
</template>
