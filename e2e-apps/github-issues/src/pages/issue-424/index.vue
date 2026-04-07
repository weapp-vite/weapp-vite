<script setup lang="ts">
import bannerImage from '@/assets/images/home/banner-1.jpg'
import goodsImage from '@/assets/images/home/goods-1.png'

definePageJson({
  navigationBarTitleText: 'issue-424',
})

function _runE2E() {
  return {
    bannerImage,
    goodsImage,
  }
}
</script>

<template>
  <view class="issue424-page">
    <text class="issue424-title">issue-424 duplicated imported src asset output</text>
    <image class="issue424-image" :src="goodsImage" mode="aspectFit" />
    <image class="issue424-image" :src="bannerImage" mode="aspectFit" />
  </view>
</template>

<style scoped>
.issue424-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 32rpx;
}

.issue424-title {
  font-size: 28rpx;
}

.issue424-image {
  width: 160rpx;
  height: 160rpx;
}
</style>
