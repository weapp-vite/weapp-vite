<script setup lang="ts">
defineOptions({
  name: 'UiVantImagePage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-image',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-image
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-image />
      </view>
    </view>
  </van-config-provider>
</template>
