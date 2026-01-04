<script setup lang="ts">
defineOptions({
  name: 'UiVantSliderPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-slider',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-slider
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-slider />
      </view>
    </view>
  </van-config-provider>
</template>
