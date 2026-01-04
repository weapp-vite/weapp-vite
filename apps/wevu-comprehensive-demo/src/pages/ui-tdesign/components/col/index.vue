<script setup lang="ts">
defineOptions({
  name: 'UiTDesignColPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-col',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-col
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-row gutter="8">
        <t-col span="4"><view style="padding: 16rpx; background: #eef2ff; border-radius: 12rpx; text-align: center">t-col</view></t-col>
        <t-col span="4"><view style="padding: 16rpx; background: #eef2ff; border-radius: 12rpx; text-align: center">t-col</view></t-col>
        <t-col span="4"><view style="padding: 16rpx; background: #eef2ff; border-radius: 12rpx; text-align: center">t-col</view></t-col>
      </t-row>
    </view>
  </view>
</template>

