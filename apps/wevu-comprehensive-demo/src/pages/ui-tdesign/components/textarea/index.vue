<script setup lang="ts">
defineOptions({
  name: 'UiTDesignTextareaPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-textarea',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-textarea
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-textarea />
    </view>
  </view>
</template>
