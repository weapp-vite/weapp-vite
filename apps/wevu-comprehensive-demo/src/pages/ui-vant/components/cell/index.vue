<script setup lang="ts">
defineOptions({
  name: 'UiVantCellPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-cell',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-cell
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-cell />
      </view>
    </view>
  </van-config-provider>
</template>
