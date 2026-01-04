<script setup lang="ts">
defineOptions({
  name: 'UiVantSubmitBarPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-submit-bar',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-submit-bar
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-submit-bar />
    </view>
  </view>
</van-config-provider>
</template>

