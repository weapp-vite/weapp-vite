<script setup lang="ts">
defineOptions({
  name: 'UiVantCellGroupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-cell-group',
}))
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-cell-group
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-cell-group />
      </view>
    </view>
  </van-config-provider>
</template>
