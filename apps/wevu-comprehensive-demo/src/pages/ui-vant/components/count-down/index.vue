<script setup lang="ts">
defineOptions({
  name: 'UiVantCountDownPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-count-down',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-count-down
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-count-down />
    </view>
  </view>
</van-config-provider>
</template>

