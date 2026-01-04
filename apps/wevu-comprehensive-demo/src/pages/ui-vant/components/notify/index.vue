<script setup lang="ts">
defineOptions({
  name: 'UiVantNotifyPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-notify',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-notify
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-notify id="van-notify" />
      </view>
    </view>
  </van-config-provider>
</template>
