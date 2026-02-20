<script lang="ts">
Component({
  data: { icon: 'cart' },

  properties: {
    count: {
      type: Number,
    },
  },

  methods: {
    goToCart() {
      wx.switchTab({
        url: '/pages/cart/index',
      });
    },
  },
});
</script>

<template>
<view class="floating-button [position:fixed] [right:20rpx] [bottom:108rpx] [&_.floating-inner-container]:[display:flex] [&_.floating-inner-container]:[align-items:center] [&_.floating-inner-container]:[justify-content:center] [&_.floating-inner-container]:[height:96rpx] [&_.floating-inner-container]:[width:96rpx] [&_.floating-inner-container]:[background-color:rgba(0,_0,_0,_0.8)] [&_.floating-inner-container]:[opacity:0.7] [&_.floating-inner-container]:[border-radius:48rpx] [&_.floating-right-top]:[position:absolute] [&_.floating-right-top]:[right:0rpx] [&_.floating-right-top]:[top:0rpx] [&_.floating-right-top]:[height:28rpx] [&_.floating-right-top]:[background:#fa4126] [&_.floating-right-top]:[border-radius:64rpx] [&_.floating-right-top]:[font-weight:bold] [&_.floating-right-top]:[font-size:22rpx] [&_.floating-right-top]:[line-height:28rpx] [&_.floating-right-top]:[color:#fff] [&_.floating-right-top]:[padding:0_8rpx]" bind:tap="goToCart">
	<view class="floating-inner-container">
		<t-icon
		  prefix="wr"
		  name="{{icon}}"
		  size="42rpx"
		  color="#FFFFFF"
		/>
	</view>
	<view class="floating-right-top">
		{{count}}
	</view>
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
