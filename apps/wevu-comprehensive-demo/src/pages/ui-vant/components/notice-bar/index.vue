<script setup lang="ts">
defineOptions({
  name: 'UiVantNoticeBarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-notice-bar',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-notice-bar
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-notice-bar />
      </view>
    </view>
  </van-config-provider>
</template>
