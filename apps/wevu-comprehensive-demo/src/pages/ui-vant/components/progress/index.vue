<script setup lang="ts">
defineOptions({
  name: 'UiVantProgressPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-progress',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-progress
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-progress />
    </view>
  </view>
</van-config-provider>
</template>

