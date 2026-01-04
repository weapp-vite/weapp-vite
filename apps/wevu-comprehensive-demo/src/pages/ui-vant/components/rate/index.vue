<script setup lang="ts">
defineOptions({
  name: 'UiVantRatePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-rate',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-rate
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-rate />
      </view>
    </view>
  </van-config-provider>
</template>
