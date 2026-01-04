<script setup lang="ts">
defineOptions({
  name: 'UiTDesignPullDownRefreshPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-pull-down-refresh',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-pull-down-refresh
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-pull-down-refresh />
    </view>
  </view>
</template>
