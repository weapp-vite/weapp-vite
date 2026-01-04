<script setup lang="ts">
defineOptions({
  name: 'UiVantIndexAnchorPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-index-anchor',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-index-anchor
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-index-anchor />
    </view>
  </view>
</van-config-provider>
</template>

