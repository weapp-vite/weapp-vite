<script setup lang="ts">
defineOptions({
  name: 'UiTDesignBadgePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-badge',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-badge
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-badge count="8"><view style="padding: 16rpx">badge</view></t-badge>
    </view>
  </view>
</template>

