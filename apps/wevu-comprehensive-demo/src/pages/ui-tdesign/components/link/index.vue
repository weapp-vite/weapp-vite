<script setup lang="ts">
defineOptions({
  name: 'UiTDesignLinkPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-link',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-link
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-link />
    </view>
  </view>
</template>
