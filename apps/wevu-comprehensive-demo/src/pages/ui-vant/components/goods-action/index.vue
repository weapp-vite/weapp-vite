<script setup lang="ts">
defineOptions({
  name: 'UiVantGoodsActionPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-goods-action',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-goods-action
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-goods-action />
      </view>
    </view>
  </van-config-provider>
</template>
