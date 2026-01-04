<script setup lang="ts">
defineOptions({
  name: 'UiVantLoadingPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-loading',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-loading
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-loading />
      </view>
    </view>
  </van-config-provider>
</template>
