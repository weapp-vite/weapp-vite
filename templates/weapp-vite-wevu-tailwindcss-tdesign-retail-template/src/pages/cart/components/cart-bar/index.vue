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
  handleSelectAll: [payload: { isAllSelected: boolean }]
  handleToSettle: []
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

defineComponentJson({
  component: true,
  usingComponents: {
    'price': '/components/price/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view v-if="fixed" class="cart-bar__placeholder h-[100rpx]" />
  <view :class="`cart-bar ${fixed ? 'cart-bar--fixed' : ''} flex flex-v-center items-center h-[112rpx] bg-white [border-top:1rpx_solid_#e5e5e5] p-[16rpx_32rpx] box-border text-[24rpx] leading-[36rpx] text-[#333] fixed inset-x-0 z-99 bottom-[calc(100rpx+env(safe-area-inset-bottom))] [&_.cart-bar__check]:mr-[12rpx] [&_.cart-bar__total]:ml-[24rpx] [&_.account-btn]:w-[192rpx] [&_.account-btn]:h-[80rpx] [&_.account-btn]:rounded-[40rpx] [&_.account-btn]:bg-[#fa4126] [&_.account-btn]:text-[28rpx] [&_.account-btn]:[font-weight:bold] [&_.account-btn]:leading-[80rpx] [&_.account-btn]:text-[#ffffff] [&_.account-btn]:text-center [&_.disabled-btn]:bg-[#cccccc] [&_.hover-btn]:opacity-50`" :style="`bottom: ${fixed ? `calc(${bottomHeight}rpx + env(safe-area-inset-bottom))` : ''};`">
    <t-icon
      size="40rpx"
      :color="isAllSelected ? '#FA4126' : '#BBBBBB'"
      :name="isAllSelected ? 'check-circle-filled' : 'circle'"
      class="cart-bar__check"
      @tap.stop="handleSelectAll"
    />
    <text>全选</text>
    <view class="cart-bar__total flex1 flex-1 flex [&_.cart-bar__total--bold]:text-[28rpx] [&_.cart-bar__total--bold]:leading-[40rpx] [&_.cart-bar__total--bold]:text-[#333] [&_.cart-bar__total--bold]:[font-weight:bold] [&_.cart-bar__total--normal]:text-[24rpx] [&_.cart-bar__total--normal]:leading-[32rpx] [&_.cart-bar__total--normal]:text-[#999] [&_.cart-bar__total--price]:text-[#fa4126] [&_.cart-bar__total--price]:[font-weight:bold]">
      <view>
        <text class="cart-bar__total--bold text-padding-right pr-[4rpx]">
          总计
        </text>
        <price
          :price="totalAmount || '0'"
          :fill="false"
          decimalSmaller
          class="cart-bar__total--bold cart-bar__total--price"
        />
        <text class="cart-bar__total--normal">
          （不含运费）
        </text>
      </view>
      <view v-if="totalDiscountAmount">
        <text class="cart-bar__total--normal text-padding-right pr-[4rpx]">
          已优惠
        </text>
        <price class="cart-bar__total--normal" :price="totalDiscountAmount || '0'" :fill="false" />
      </view>
    </view>
    <view :class="`${!isDisabled ? '' : 'disabled-btn'} account-btn`" :hover-class="!isDisabled ? '' : 'hover-btn'" @tap.stop="handleToSettle">
      去结算({{ totalGoodsNum }})
    </view>
  </view>
</template>

<style>
.cart-bar__placeholder {
  width: 100%;
  height: 100rpx;
}

.cart-bar {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 112rpx;
  padding: 16rpx 32rpx;
  font-size: 24rpx;
  line-height: 36rpx;
  color: #333;
  background: #fff;
  border-top: 1rpx solid #e5e5e5;
}

.cart-bar--fixed {
  position: fixed;
  right: 0;
  bottom: 100rpx;
  left: 0;
  z-index: 99;
}

.cart-bar__check {
  margin-right: 12rpx;
}

.cart-bar__total {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-left: 24rpx;
}

.cart-bar__total--bold {
  font-size: 28rpx;
  font-weight: bold;
  line-height: 40rpx;
  color: #333;
}

.cart-bar__total--normal {
  font-size: 24rpx;
  line-height: 32rpx;
  color: #999;
}

.cart-bar__total--price {
  color: #fa4126;
}

.text-padding-right {
  padding-right: 4rpx;
}

.account-btn {
  width: 192rpx;
  height: 80rpx;
  font-size: 28rpx;
  font-weight: bold;
  line-height: 80rpx;
  color: #fff;
  text-align: center;
  background: #fa4126;
  border-radius: 40rpx;
}

.disabled-btn {
  background: #ccc;
}

.hover-btn {
  opacity: 0.5;
}
</style>
