<script setup lang="ts">
defineOptions({
  name: 'UiTDesignCalendarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-calendar',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-calendar
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-calendar />
    </view>
  </view>
</template>
