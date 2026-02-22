<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
})

withDefaults(defineProps<{
  addressData?: Record<string, any>
}>(), {
  addressData: () => ({}),
})

const emit = defineEmits<{
  addressclick: []
  addclick: []
}>()

function onAddressTap() {
  emit('addressclick')
}

function onAddTap() {
  emit('addclick')
}

defineExpose({
  onAddressTap,
  onAddTap,
})
</script>

<template>
<wxs module="utils">
	var hidePhoneNum = function(array) {
	if (!array) return;
	var mphone = array.substring(0, 3) + '****' + array.substring(7);
	return mphone;
	}
	module.exports = {
	hidePhoneNum:hidePhoneNum
	}
</wxs>

<view class="address-card wr-class [background:#fff] [margin:0rpx_0rpx_24rpx] [&_.wr-cell__title]:[color:#999] [&_.wr-cell__title]:[margin-left:6rpx] [&_.order-address]:[display:flex] [&_.order-address]:[width:100%] [&_.order-address_.address-content]:[flex:1] [&_.order-address_.title]:[display:flex] [&_.order-address_.title]:[align-items:center] [&_.order-address_.title]:[height:40rpx] [&_.order-address_.title]:[font-size:28rpx] [&_.order-address_.title]:[font-weight:normal] [&_.order-address_.title]:[color:#999999] [&_.order-address_.title]:[line-height:40rpx] [&_.order-address_.title_.address-tag]:[width:52rpx] [&_.order-address_.title_.address-tag]:[height:29rpx] [&_.order-address_.title_.address-tag]:[border:1rpx_solid_#0091ff] [&_.order-address_.title_.address-tag]:[background-color:rgba(122,_167,_251,_0.1)] [&_.order-address_.title_.address-tag]:[text-align:center] [&_.order-address_.title_.address-tag]:[line-height:29rpx] [&_.order-address_.title_.address-tag]:[border-radius:8rpx] [&_.order-address_.title_.address-tag]:[color:#0091ff] [&_.order-address_.title_.address-tag]:[font-size:20rpx] [&_.order-address_.title_.address-tag]:[margin-right:12rpx] [&_.order-address_.detail]:[overflow:hidden] [&_.order-address_.detail]:[text-overflow:ellipsis] [&_.order-address_.detail]:[display:-webkit-box] [&_.order-address_.detail]:[-webkit-box-orient:vertical] [&_.order-address_.detail]:[-webkit-line-clamp:2] [&_.order-address_.detail]:[font-size:36rpx] [&_.order-address_.detail]:[font-weight:bold] [&_.order-address_.detail]:[color:#333333] [&_.order-address_.detail]:[line-height:48rpx] [&_.order-address_.detail]:[margin:8rpx_0] [&_.order-address_.info]:[height:40rpx] [&_.order-address_.info]:[font-size:28rpx] [&_.order-address_.info]:[font-weight:normal] [&_.order-address_.info]:[color:#333333] [&_.order-address_.info]:[line-height:40rpx] [&_.top-line]:[width:100%] [&_.top-line]:[height:6rpx] [&_.top-line]:[background-color:#fff] [&_.top-line]:[background-image:url(https://tdesign.gtimg.com/miniprogram/template/retail/order/stripe.png)] [&_.top-line]:[background-repeat:repeat-x] [&_.top-line]:[display:block]">
	<t-cell wx:if="{{addressData && addressData.detailAddress}}" bindtap="onAddressTap" hover>
		<view class="order-address [&_.address__right]:[align-self:center]" slot="title">
			<t-icon name="location" color="#333333" size="40rpx" />
			<view class="address-content">
				<view class="title">
					<view class="address-tag" wx:if="{{addressData.addressTag}}">
						{{addressData.addressTag}}
					</view>
					{{addressData.provinceName}} {{addressData.cityName}} {{addressData.districtName}}
				</view>
				<view class="detail">{{addressData.detailAddress}}</view>
				<view class="info">
					{{addressData.name}} {{utils.hidePhoneNum(addressData.phone)}}
				</view>
			</view>
			<t-icon
			 class="address__right"
			 name="chevron-right"
			 color="#BBBBBB"
			 size="40rpx"
			/>
		</view>
	</t-cell>
	<t-cell
	 wx:else
	 bindtap="onAddTap"
	 title="添加收货地址"
	 hover
	>
		<t-icon name="add-circle" slot="left-icon" size="40rpx" />
	</t-cell>
	<view class="top-line" />
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}
</json>
