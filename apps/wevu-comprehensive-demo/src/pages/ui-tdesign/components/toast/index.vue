<script setup lang="ts">
defineOptions({
  name: 'UiTDesignToastPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-toast',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-toast
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-toast id="t-toast" />
    </view>
  </view>
</template>
