<script setup lang="ts">
defineOptions({
  name: 'UiVantTagPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-tag',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-tag
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-tag type="primary">primary</van-tag>
      <van-tag type="success">success</van-tag>
    </view>
  </view>
</van-config-provider>
</template>

