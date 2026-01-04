<script setup lang="ts">
defineOptions({
  name: 'UiVantCirclePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-circle',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-circle
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-circle />
      </view>
    </view>
  </van-config-provider>
</template>
