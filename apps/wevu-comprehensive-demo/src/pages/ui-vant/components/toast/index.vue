<script setup lang="ts">
defineOptions({
  name: 'UiVantToastPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-toast',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-toast
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-toast id="van-toast" />
      </view>
    </view>
  </van-config-provider>
</template>
