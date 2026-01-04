<script setup lang="ts">
defineOptions({
  name: 'UiVantConfigProviderPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-config-provider',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-config-provider
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-config-provider>
          <view style="padding: 16rpx">
            content
          </view>
        </van-config-provider>
      </view>
    </view>
  </van-config-provider>
</template>
