<script setup lang="ts">
defineOptions({
  name: 'UiVantIconPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-icon',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-icon
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-icon name="star-o" />
      </view>
    </view>
  </van-config-provider>
</template>
