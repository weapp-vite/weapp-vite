<script setup lang="ts">
defineOptions({
  name: 'UiTDesignCellPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-cell',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-cell
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-cell />
    </view>
  </view>
</template>
