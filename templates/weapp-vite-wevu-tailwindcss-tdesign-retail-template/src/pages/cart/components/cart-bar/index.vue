<script setup lang="ts">
import { ref, watch } from 'wevu'

defineOptions({
  options: {
    addGlobalClass: true,
  },
})

const props = withDefaults(defineProps<{
  isAllSelected?: boolean
  totalAmount?: number | string
  totalGoodsNum?: number | string
  totalDiscountAmount?: number | string
  bottomHeight?: number
  fixed?: boolean
}>(), {
  isAllSelected: false,
  totalAmount: 1,
  totalGoodsNum: 0,
  totalDiscountAmount: 0,
  bottomHeight: 100,
  fixed: false,
})

const emit = defineEmits<{
  'handleSelectAll': [payload: { isAllSelected: boolean }]
  'handleToSettle': []
}>()

const isDisabled = ref(false)
const isAllSelected = ref(!!props.isAllSelected)

watch(
  () => props.isAllSelected,
  (next) => {
    isAllSelected.value = !!next
  },
  { immediate: true },
)

watch(
  () => props.totalGoodsNum,
  (num) => {
    const nextDisabled = Number(num || 0) === 0
    setTimeout(() => {
      isDisabled.value = nextDisabled
    })
  },
  { immediate: true },
)

function handleSelectAll() {
  const current = isAllSelected.value
  isAllSelected.value = !current
  emit('handleSelectAll', {
    isAllSelected: current,
  })
}

function handleToSettle() {
  if (isDisabled.value) {
    return
  }
  emit('handleToSettle')
}

defineExpose({
  isDisabled,
  isAllSelected,
  handleSelectAll,
  handleToSettle,
})
</script>

<template>
<view class="cart-bar__placeholder [height:100rpx]" wx:if="{{fixed}}" />
<view class="cart-bar {{fixed ? 'cart-bar--fixed' : ''}} flex flex-v-center [display:flex] [align-items:center] [height:112rpx] [background-color:#fff] [border-top:1rpx_solid_#e5e5e5] [padding:16rpx_32rpx] [box-sizing:border-box] [font-size:24rpx] [line-height:36rpx] [color:#333] [position:fixed] [left:0] [right:0] [z-index:99] [bottom:calc(100rpx_+_env(safe-area-inset-bottom))] [&_.cart-bar__check]:[margin-right:12rpx] [&_.cart-bar__total]:[margin-left:24rpx] [&_.account-btn]:[width:192rpx] [&_.account-btn]:[height:80rpx] [&_.account-btn]:[border-radius:40rpx] [&_.account-btn]:[background-color:#fa4126] [&_.account-btn]:[font-size:28rpx] [&_.account-btn]:[font-weight:bold] [&_.account-btn]:[line-height:80rpx] [&_.account-btn]:[color:#ffffff] [&_.account-btn]:[text-align:center] [&_.disabled-btn]:[background-color:#cccccc] [&_.hover-btn]:[opacity:0.5]" style="bottom: {{fixed ? 'calc(' + bottomHeight + 'rpx + env(safe-area-inset-bottom))' : ''}};">
	<t-icon
	 size="40rpx"
	 color="{{isAllSelected ? '#FA4126' : '#BBBBBB'}}"
	 name="{{isAllSelected ? 'check-circle-filled' : 'circle'}}"
	 class="cart-bar__check"
	 catchtap="handleSelectAll"
	/>
	<text>全选</text>
	<view class="cart-bar__total flex1 [flex:1] [display:flex] [&_.cart-bar__total--bold]:[font-size:28rpx] [&_.cart-bar__total--bold]:[line-height:40rpx] [&_.cart-bar__total--bold]:[color:#333] [&_.cart-bar__total--bold]:[font-weight:bold] [&_.cart-bar__total--normal]:[font-size:24rpx] [&_.cart-bar__total--normal]:[line-height:32rpx] [&_.cart-bar__total--normal]:[color:#999] [&_.cart-bar__total--price]:[color:#fa4126] [&_.cart-bar__total--price]:[font-weight:bold]">
		<view>
			<text class="cart-bar__total--bold text-padding-right [padding-right:4rpx]">总计</text>
			<price
			 price="{{totalAmount || '0'}}"
			 fill="{{false}}"
			 decimalSmaller
			 class="cart-bar__total--bold cart-bar__total--price"
			/>
			<text class="cart-bar__total--normal">（不含运费）</text>
		</view>
		<view wx:if="{{totalDiscountAmount}}">
			<text class="cart-bar__total--normal text-padding-right [padding-right:4rpx]">已优惠</text>
			<price class="cart-bar__total--normal" price="{{totalDiscountAmount || '0'}}" fill="{{false}}" />
		</view>
	</view>
	<view catchtap="handleToSettle" class="{{!isDisabled ? '' : 'disabled-btn'}} account-btn" hover-class="{{!isDisabled ? '' : 'hover-btn'}}">
		去结算({{totalGoodsNum}})
	</view>
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "price": "/components/price/index",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
