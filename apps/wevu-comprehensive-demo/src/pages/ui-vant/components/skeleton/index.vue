<script setup lang="ts">
defineOptions({
  name: 'UiVantSkeletonPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-skeleton',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-skeleton
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-skeleton />
    </view>
  </view>
</van-config-provider>
</template>

