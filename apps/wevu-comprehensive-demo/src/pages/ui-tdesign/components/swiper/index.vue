<script setup lang="ts">
defineOptions({
  name: 'UiTDesignSwiperPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-swiper',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-swiper
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-swiper style="height: 120px">
        <t-swiper-nav />
        <view style="height: 120px; display: flex; align-items: center; justify-content: center; background: #f1f5f9">
          item 1
        </view>
        <view style="height: 120px; display: flex; align-items: center; justify-content: center; background: #f1f5f9">
          item 2
        </view>
      </t-swiper>
    </view>
  </view>
</template>
