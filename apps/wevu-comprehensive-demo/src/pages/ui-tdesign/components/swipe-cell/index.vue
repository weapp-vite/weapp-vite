<script setup lang="ts">
defineOptions({
  name: 'UiTDesignSwipeCellPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-swipe-cell',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-swipe-cell
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-swipe-cell>
        <template #left>
          <view style="height: 100%; display: flex; align-items: center; padding: 0 24rpx; background: #fee2e2; color: #991b1b">left</view>
        </template>
        <view style="padding: 24rpx; background: #fff">swipe content</view>
        <template #right>
          <view style="height: 100%; display: flex; align-items: center; padding: 0 24rpx; background: #fee2e2; color: #991b1b">right</view>
        </template>
      </t-swipe-cell>
    </view>
  </view>
</template>

