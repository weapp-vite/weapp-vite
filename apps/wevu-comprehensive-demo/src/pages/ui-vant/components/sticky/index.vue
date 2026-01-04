<script setup lang="ts">
defineOptions({
  name: 'UiVantStickyPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-sticky',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-sticky
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-sticky />
    </view>
  </view>
</van-config-provider>
</template>

