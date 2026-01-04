<script setup lang="ts">
defineOptions({
  name: 'UiVantGoodsActionButtonPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-goods-action-button',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-goods-action-button
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-goods-action-button />
      </view>
    </view>
  </van-config-provider>
</template>
