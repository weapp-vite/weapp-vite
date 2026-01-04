<script setup lang="ts">
defineOptions({
  name: 'UiVantButtonPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-button',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-button
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-button type="primary" size="small">
          primary
        </van-button>
        <van-button type="default" size="small">
          default
        </van-button>
        <van-button type="danger" size="small">
          danger
        </van-button>
      </view>
    </view>
  </van-config-provider>
</template>
