<script setup lang="ts">
defineOptions({
  name: 'UiVantInfoPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-info',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-info
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-info />
      </view>
    </view>
  </van-config-provider>
</template>
