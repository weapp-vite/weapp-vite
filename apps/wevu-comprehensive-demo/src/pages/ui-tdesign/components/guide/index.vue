<script setup lang="ts">
defineOptions({
  name: 'UiTDesignGuidePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-guide',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-guide
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-guide />
    </view>
  </view>
</template>

