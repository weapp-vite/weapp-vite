<script setup lang="ts">
defineOptions({
  name: 'UiVantTransitionPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-transition',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-transition
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-transition />
    </view>
  </view>
</van-config-provider>
</template>

