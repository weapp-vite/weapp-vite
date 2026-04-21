<script setup lang="ts">
import { wpi } from 'wevu/api'

defineOptions({
  data() {
    return {
      icon: 'cart',
    }
  },
  properties: {
    count: {
      type: Number,
    },
  },
  methods: {
    async goToCart() {
      await wpi.switchTab({
        url: '/pages/cart/index',
      })
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view class="floating-button fixed right-[20rpx] bottom-[108rpx] [&_.floating-inner-container]:flex [&_.floating-inner-container]:items-center [&_.floating-inner-container]:justify-center [&_.floating-inner-container]:size-[96rpx] [&_.floating-inner-container]:bg-[rgba(0,0,0,0.8)] [&_.floating-inner-container]:opacity-[0.7] [&_.floating-inner-container]:rounded-[48rpx] [&_.floating-right-top]:absolute [&_.floating-right-top]:right-0 [&_.floating-right-top]:top-0 [&_.floating-right-top]:h-[28rpx] [&_.floating-right-top]:[background:#fa4126] [&_.floating-right-top]:rounded-[64rpx] [&_.floating-right-top]:[font-weight:bold] [&_.floating-right-top]:text-[22rpx] [&_.floating-right-top]:leading-[28rpx] [&_.floating-right-top]:text-white [&_.floating-right-top]:p-[0_8rpx]" @tap="goToCart">
    <view class="floating-inner-container">
      <t-icon
        prefix="wr"
        :name="icon"
        size="42rpx"
        color="#FFFFFF"
      />
    </view>
    <view class="floating-right-top">
      {{ count }}
    </view>
  </view>
</template>
