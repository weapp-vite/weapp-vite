<script setup lang="ts">
defineOptions({
  name: 'UiTDesignBackTopPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-back-top',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-back-top
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-back-top />
    </view>
  </view>
</template>
