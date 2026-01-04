<script setup lang="ts">
defineOptions({
  name: 'UiTDesignFabPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-fab',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-fab
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-fab />
    </view>
  </view>
</template>

