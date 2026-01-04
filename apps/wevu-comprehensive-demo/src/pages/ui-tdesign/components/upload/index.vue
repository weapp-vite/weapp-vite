<script setup lang="ts">
defineOptions({
  name: 'UiTDesignUploadPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-upload',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-upload
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-upload />
    </view>
  </view>
</template>

