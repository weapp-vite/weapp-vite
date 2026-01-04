<script setup lang="ts">
defineOptions({
  name: 'UiVantEmptyPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-empty',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-empty
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-empty />
      </view>
    </view>
  </van-config-provider>
</template>
