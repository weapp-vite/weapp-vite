<script setup lang="ts">
defineOptions({
  name: 'UiVantSwipeCellPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-swipe-cell',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-swipe-cell
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-swipe-cell />
    </view>
  </view>
</van-config-provider>
</template>

