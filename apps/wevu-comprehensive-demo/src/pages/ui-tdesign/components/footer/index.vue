<script setup lang="ts">
defineOptions({
  name: 'UiTDesignFooterPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-footer',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-footer
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-footer />
    </view>
  </view>
</template>

