<script setup lang="ts">
defineOptions({
  properties: {
    imgUrl: {
      type: String,
      value: 'https://tdesign.gtimg.com/miniprogram/template/retail/template/empty-cart.png'
    },
    tip: {
      type: String,
      value: '购物车是空的'
    },
    btnText: {
      type: String,
      value: '去首页'
    }
  },
  data() {
    return {};
  },
  methods: {
    handleClick() {
      this.triggerEvent('handleClick');
    }
  }
});
</script>

<template>
<view class="cart-empty [padding:64rpx_0rpx] [display:flex] [flex-direction:column] [align-items:center] [box-sizing:border-box] [height:calc(100vh_-_100rpx)] [background-color:#f5f5f5] [&_.cart-img]:[width:160rpx] [&_.cart-img]:[height:160rpx] [&_.cart-img]:[margin-bottom:24rpx] [&_.tip]:[font-size:28rpx] [&_.tip]:[line-height:40rpx] [&_.tip]:[color:#999] [&_.tip]:[margin-bottom:24rpx] [&_.btn]:[width:240rpx] [&_.btn]:[height:72rpx] [&_.btn]:[border-radius:36rpx] [&_.btn]:[text-align:center] [&_.btn]:[line-height:72rpx] [&_.btn]:[border:2rpx_solid_#fa4126] [&_.btn]:[color:#fa4126] [&_.btn]:[background-color:transparent] [&_.btn]:[font-size:28rpx] [&_.btn]:[font-weight:bold]">
	<t-image t-class="cart-img" src="{{imgUrl}}" />
	<view class="tip">{{tip}}</view>
	<view class="btn" bind:tap="handleClick">{{btnText}}</view>
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-image": "/components/webp-image/index"
  }
}</json>
