<script setup lang="ts">
withDefaults(defineProps<{
  imgUrl?: string
  tip?: string
  btnText?: string
}>(), {
  imgUrl: 'https://tdesign.gtimg.com/miniprogram/template/retail/template/empty-cart.png',
  tip: '购物车是空的',
  btnText: '去首页',
})

const emit = defineEmits<{
  handleClick: []
}>()

function handleClick() {
  emit('handleClick')
}

defineExpose({
  handleClick,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <view class="cart-empty p-[64rpx_0rpx] flex flex-col items-center box-border h-[calc(100vh-100rpx)] bg-[#f5f5f5] [&_.cart-img]:size-[160rpx] [&_.cart-img]:mb-[24rpx] [&_.tip]:text-[28rpx] [&_.tip]:leading-[40rpx] [&_.tip]:text-[#999] [&_.tip]:mb-[24rpx] [&_.btn]:w-[240rpx] [&_.btn]:h-[72rpx] [&_.btn]:rounded-[36rpx] [&_.btn]:text-center [&_.btn]:leading-[72rpx] [&_.btn]:[border:2rpx_solid_#fa4126] [&_.btn]:text-[#fa4126] [&_.btn]:bg-transparent [&_.btn]:text-[28rpx] [&_.btn]:[font-weight:bold]">
    <t-image t-class="cart-img" :src="imgUrl" />
    <view class="tip">
      {{ tip }}
    </view>
    <view class="btn" @tap="handleClick">
      {{ btnText }}
    </view>
  </view>
</template>
