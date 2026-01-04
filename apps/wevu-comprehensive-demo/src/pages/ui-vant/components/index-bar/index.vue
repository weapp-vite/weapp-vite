<script setup lang="ts">
defineOptions({
  name: 'UiVantIndexBarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-index-bar',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-index-bar
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-index-bar />
      </view>
    </view>
  </van-config-provider>
</template>
