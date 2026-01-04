<script setup lang="ts">
defineOptions({
  name: 'UiTDesignCheckTagPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-check-tag',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-check-tag
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-check-tag />
    </view>
  </view>
</template>
