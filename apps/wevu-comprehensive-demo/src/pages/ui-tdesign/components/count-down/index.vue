<script setup lang="ts">
defineOptions({
  name: 'UiTDesignCountDownPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-count-down',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-count-down
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-count-down />
    </view>
  </view>
</template>

