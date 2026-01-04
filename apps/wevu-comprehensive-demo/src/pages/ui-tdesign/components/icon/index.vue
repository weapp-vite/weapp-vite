<script setup lang="ts">
defineOptions({
  name: 'UiTDesignIconPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-icon',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-icon
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-icon name="app" />
    </view>
  </view>
</template>
