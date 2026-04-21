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
  toAddCart: []
  toBuyNow: [detail: any]
  toNav: [detail: { e: any, url: string }]
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

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view v-if="soldout || !isStock" class="flex soldout flex-center wr-sold-out h-[80rpx] [background:rgba(170,170,170,1)] w-full text-white [display:flex] [display:-webkit-flex] justify-center [-webkit-justify-content:center] items-center [-webkit-align-items:center]">
    {{ soldout ? '商品已下架' : '商品已售馨' }}
  </view>
  <view class="footer-cont flex flex-between wr-class bg-white p-[16rpx] [display:flex] [display:-webkit-flex] justify-between [-webkit-justify-content:space-between]">
    <view v-if="jumpArray.length > 0" class="flex flex-between bottom-operate-left w-full [display:flex] [display:-webkit-flex] justify-between [-webkit-justify-content:space-between] [&_.icon-warp]:w-[50%]">
      <view
        v-for="(item, index) in jumpArray"
        :key="index"
        class="icon-warp operate-wrap w-[110rpx] flex justify-center items-center text-center relative [display:-webkit-flex]"
        data-ele="foot_navigation"
        :data-index="index"
        :data-url="item.url"
        @tap="toNav"
      >
        <view>
          <text v-if="shopCartNum > 0 && item.showCartNum" class="tag-cart-num inline-block absolute left-[50rpx] right-auto top-[6rpx] text-white leading-[24rpx] text-center z-99 whitespace-nowrap min-w-[28rpx] rounded-[14rpx] bg-[#fa550f]! text-[20rpx] font-normal p-[2rpx_6rpx]">
            {{ shopCartNum > 99 ? '99+' : shopCartNum }}
          </text>
          <t-icon prefix="wr" :name="item.iconName" size="40rpx" />
          <view class="operate-text text-[#666] text-[20rpx]">
            {{ item.title }}
          </view>
        </view>
      </view>
    </view>
    <block v-if="buttonType === 1">
      <view class="flex buy-buttons [display:flex] [display:-webkit-flex]">
        <view :class="`bar-separately ${soldout || !isStock ? 'bar-addCart-disabled' : ''} [width:254rpx] h-[80rpx] text-white flex items-center justify-center [background:#ffece9] [color:#fa4126] rounded-[40rpx_0_0_40rpx] [background:rgba(170,_170,_170,_1)] w-full [background:rgba(221,221,221,1)] text-[28rpx] [display:-webkit-flex]`" @tap="toAddCart">
          加入购物车
        </view>
        <view :class="`bar-buy ${soldout || !isStock ? 'bar-buyNow-disabled' : ''} [width:254rpx] h-[80rpx] text-white flex items-center justify-center bg-[#fa4126] rounded-[0rpx_40rpx_40rpx_0rpx] [background:rgba(170,_170,_170,_1)] w-full [background:rgba(198,198,198,1)] text-[28rpx] [display:-webkit-flex]`" @tap="toBuyNow">
          立即购买
        </view>
      </view>
    </block>
    <block v-if="isSlotButton">
      <slot name="buyButton" />
    </block>
  </view>
</template>
