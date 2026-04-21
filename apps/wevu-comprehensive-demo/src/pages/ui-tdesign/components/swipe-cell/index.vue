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
          <view style=" display: flex; align-items: center;height: 100%; padding: 0 24rpx; color: #991b1b; background: #fee2e2">
            left
          </view>
        </template>
        <view style="padding: 24rpx; background: #fff">
          swipe content
        </view>
        <template #right>
          <view style=" display: flex; align-items: center;height: 100%; padding: 0 24rpx; color: #991b1b; background: #fee2e2">
            right
          </view>
        </template>
      </t-swipe-cell>
    </view>
  </view>
</template>
