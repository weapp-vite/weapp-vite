<script setup lang="ts">
defineOptions({
  name: 'UiVantDividerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-divider',
}))
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-divider
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-divider />
    </view>
  </view>
</van-config-provider>
</template>

