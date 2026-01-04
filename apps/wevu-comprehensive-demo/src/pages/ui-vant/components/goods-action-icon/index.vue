<script setup lang="ts">
defineOptions({
  name: 'UiVantGoodsActionIconPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-goods-action-icon',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-goods-action-icon
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-goods-action-icon />
      </view>
    </view>
  </van-config-provider>
</template>
