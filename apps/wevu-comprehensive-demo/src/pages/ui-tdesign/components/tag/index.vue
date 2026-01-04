<script setup lang="ts">
defineOptions({
  name: 'UiTDesignTagPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-tag',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-tag
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-tag theme="primary">primary</t-tag>
      <t-tag theme="success">success</t-tag>
    </view>
  </view>
</template>

