<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  externalClasses: ['wr-sold-out', 'wr-class'],
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  soldout?: boolean
  jumpArray?: any[]
  isStock?: boolean
  isSlotButton?: boolean
  shopCartNum?: number
  buttonType?: number
  minDiscountPrice?: string
  minSalePrice?: string
}>(), {
  soldout: false,
  jumpArray: () => [],
  isStock: true,
  isSlotButton: false,
  shopCartNum: 0,
  buttonType: 0,
  minDiscountPrice: '',
  minSalePrice: '',
})

const emit = defineEmits<{
  'toAddCart': []
  'toBuyNow': [detail: any]
  'toNav': [detail: { e: any, url: string }]
}>()

const fillPrice = ref(false)

function toAddCart() {
  if (!props.isStock) {
    return
  }
  emit('toAddCart')
}

function toBuyNow(e: any) {
  if (!props.isStock) {
    return
  }
  emit('toBuyNow', e)
}

function toNav(e: any) {
  const url = e?.currentTarget?.dataset?.url || ''
  emit('toNav', {
    e,
    url,
  })
}

defineExpose({
  fillPrice,
  toAddCart,
  toBuyNow,
  toNav,
})
</script>

<template>
<view class="flex soldout flex-center wr-sold-out [height:80rpx] [background:rgba(170,_170,_170,_1)] [width:100%] [color:#fff] [display:flex] [display:-webkit-flex] [justify-content:center] [-webkit-justify-content:center] [align-items:center] [-webkit-align-items:center]" wx:if="{{soldout ||  !isStock}}">
	{{soldout ? '商品已下架' : '商品已售馨'}}
</view>
<view class="footer-cont flex flex-between wr-class [background-color:#fff] [padding:16rpx] [display:flex] [display:-webkit-flex] [justify-content:space-between] [-webkit-justify-content:space-between]">
	<view class="flex flex-between bottom-operate-left [width:100%] [display:flex] [display:-webkit-flex] [justify-content:space-between] [-webkit-justify-content:space-between] [&_.icon-warp]:[width:50%]" wx:if="{{jumpArray.length > 0}}">
		<view
		  wx:for="{{jumpArray}}"
		  wx:key="index"
		  class="icon-warp operate-wrap [width:110rpx] [display:flex] [justify-content:center] [align-items:center] [text-align:center] [position:relative] [display:-webkit-flex]"
		  bindtap="toNav"
		  data-ele="foot_navigation"
		  data-index="{{index}}"
		  data-url="{{item.url}}"
		>
			<view>
				<text wx:if="{{shopCartNum > 0 && item.showCartNum}}" class="tag-cart-num [display:inline-block] [position:absolute] [left:50rpx] [right:auto] [top:6rpx] [color:#fff] [line-height:24rpx] [text-align:center] [z-index:99] [white-space:nowrap] [min-width:28rpx] [border-radius:14rpx] ![background-color:#fa550f] [font-size:20rpx] [font-weight:400] [padding:2rpx_6rpx]">
					{{shopCartNum > 99 ? '99+' : shopCartNum}}
				</text>
				<t-icon prefix="wr" name="{{item.iconName}}" size="40rpx" />
				<view class="operate-text [color:#666] [font-size:20rpx]">{{item.title}}</view>
			</view>
		</view>
	</view>
	<block wx:if="{{buttonType === 1}}">
		<view class="flex buy-buttons [display:flex] [display:-webkit-flex]">
			<view class="bar-separately {{soldout || !isStock ? 'bar-addCart-disabled' : ''}} [width:254rpx] [height:80rpx] [color:#fff] [display:flex] [align-items:center] [justify-content:center] [background:#ffece9] [color:#fa4126] [border-radius:40rpx_0_0_40rpx] [background:rgba(170,_170,_170,_1)] [width:100%] [background:rgba(221,_221,_221,_1)] [font-size:28rpx] [display:-webkit-flex]" bindtap="toAddCart">
				加入购物车
			</view>
			<view class="bar-buy {{soldout || !isStock ? 'bar-buyNow-disabled' : ''}} [width:254rpx] [height:80rpx] [color:#fff] [display:flex] [align-items:center] [justify-content:center] [background-color:#fa4126] [border-radius:0rpx_40rpx_40rpx_0rpx] [background:rgba(170,_170,_170,_1)] [width:100%] [background:rgba(198,_198,_198,_1)] [font-size:28rpx] [display:-webkit-flex]" bindtap="toBuyNow">
				立即购买
			</view>
		</view>
	</block>
	<block wx:if="{{isSlotButton}}">
		<slot name="buyButton" />
	</block>
</view>

</template>

<json>
{
    "component": true,
    "usingComponents": {
        "t-icon": "tdesign-miniprogram/icon/icon"
    }
}</json>
