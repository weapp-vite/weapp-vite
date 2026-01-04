<script setup lang="ts">
defineOptions({
  name: 'UiVantRowPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-row',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-row
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-row gutter="8">
        <van-col span="8"><view style="padding: 16rpx; background: #eef2ff; border-radius: 12rpx; text-align: center">van-col</view></van-col>
        <van-col span="8"><view style="padding: 16rpx; background: #eef2ff; border-radius: 12rpx; text-align: center">van-col</view></van-col>
        <van-col span="8"><view style="padding: 16rpx; background: #eef2ff; border-radius: 12rpx; text-align: center">van-col</view></van-col>
      </van-row>
    </view>
  </view>
</van-config-provider>
</template>

