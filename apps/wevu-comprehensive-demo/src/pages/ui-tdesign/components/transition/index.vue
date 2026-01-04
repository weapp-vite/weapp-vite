<script setup lang="ts">
defineOptions({
  name: 'UiTDesignTransitionPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-transition',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-transition
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-transition />
    </view>
  </view>
</template>
