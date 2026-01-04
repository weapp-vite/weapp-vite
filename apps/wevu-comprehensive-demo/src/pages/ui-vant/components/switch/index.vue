<script setup lang="ts">
defineOptions({
  name: 'UiVantSwitchPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-switch',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-switch
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-switch />
    </view>
  </view>
</van-config-provider>
</template>

