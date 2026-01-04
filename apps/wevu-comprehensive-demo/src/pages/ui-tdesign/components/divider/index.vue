<script setup lang="ts">
defineOptions({
  name: 'UiTDesignDividerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-divider',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-divider
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-divider />
    </view>
  </view>
</template>

