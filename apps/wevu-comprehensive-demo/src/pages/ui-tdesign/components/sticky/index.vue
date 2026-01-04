<script setup lang="ts">
defineOptions({
  name: 'UiTDesignStickyPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-sticky',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-sticky
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-sticky />
    </view>
  </view>
</template>
