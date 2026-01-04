<script setup lang="ts">
defineOptions({
  name: 'UiTDesignGridItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-grid-item',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-grid-item
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-grid column="3">
        <t-grid-item text="Grid 1" />
        <t-grid-item text="Grid 2" />
        <t-grid-item text="Grid 3" />
      </t-grid>
    </view>
  </view>
</template>
