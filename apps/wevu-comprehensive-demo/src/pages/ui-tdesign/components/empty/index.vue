<script setup lang="ts">
defineOptions({
  name: 'UiTDesignEmptyPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-empty',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-empty
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-empty />
    </view>
  </view>
</template>

