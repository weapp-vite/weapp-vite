<script setup lang="ts">
defineOptions({
  name: 'UiVantPanelPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-panel',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-panel
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-panel />
      </view>
    </view>
  </van-config-provider>
</template>
