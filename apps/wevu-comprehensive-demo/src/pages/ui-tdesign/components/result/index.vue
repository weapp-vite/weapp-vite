<script setup lang="ts">
defineOptions({
  name: 'UiTDesignResultPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-result',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-result
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-result />
    </view>
  </view>
</template>
