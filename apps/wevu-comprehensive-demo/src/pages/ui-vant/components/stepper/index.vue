<script setup lang="ts">
defineOptions({
  name: 'UiVantStepperPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-stepper',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-stepper
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-stepper />
    </view>
  </view>
</van-config-provider>
</template>

