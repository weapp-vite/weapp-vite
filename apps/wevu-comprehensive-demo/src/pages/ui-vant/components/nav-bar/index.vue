<script setup lang="ts">
defineOptions({
  name: 'UiVantNavBarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-nav-bar',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-nav-bar
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-nav-bar />
      </view>
    </view>
  </van-config-provider>
</template>
