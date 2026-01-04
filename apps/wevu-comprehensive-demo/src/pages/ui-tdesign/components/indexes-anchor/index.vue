<script setup lang="ts">
defineOptions({
  name: 'UiTDesignIndexesAnchorPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-indexes-anchor',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-indexes-anchor
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-indexes>
        <t-indexes-anchor index="A" />
        <view style="padding: 12rpx 16rpx; color: #666">
          A-1
        </view>
        <t-indexes-anchor index="B" />
        <view style="padding: 12rpx 16rpx; color: #666">
          B-1
        </view>
      </t-indexes>
    </view>
  </view>
</template>
