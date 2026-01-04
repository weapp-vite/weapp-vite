<script setup lang="ts">
defineOptions({
  name: 'UiTDesignSearchPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-search',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-search
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-search />
    </view>
  </view>
</template>

