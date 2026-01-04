<script setup lang="ts">
defineOptions({
  name: 'UiVantCardPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-card',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-card
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-card />
      </view>
    </view>
  </van-config-provider>
</template>
