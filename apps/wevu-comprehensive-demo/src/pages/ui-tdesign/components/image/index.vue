<script setup lang="ts">
defineOptions({
  name: 'UiTDesignImagePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-image',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-image
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-image />
    </view>
  </view>
</template>
