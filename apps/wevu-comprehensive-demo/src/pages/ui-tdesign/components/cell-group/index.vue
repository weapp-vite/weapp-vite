<script setup lang="ts">
defineOptions({
  name: 'UiTDesignCellGroupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-cell-group',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-cell-group
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-cell-group />
    </view>
  </view>
</template>

