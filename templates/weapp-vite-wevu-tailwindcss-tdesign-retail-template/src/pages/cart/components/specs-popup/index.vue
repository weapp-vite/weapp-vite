<script setup lang="ts">
import { computed } from 'wevu'

interface PopupGoods {
  title: string
  thumb: string
  price: string
  hideKey: {
    originPrice: boolean
    tags: boolean
    specs: boolean
    num: boolean
  }
}

defineOptions({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  show?: boolean
  value?: string
  title?: string
  price?: string
  thumb?: string
  thumbMode?: string
  zIndex?: number
  specs?: string[]
}>(), {
  show: false,
  value: '',
  title: '',
  price: '',
  thumb: '',
  thumbMode: 'aspectFit',
  zIndex: 99,
  specs: () => [],
})

const emit = defineEmits<{
  close: []
  closeover: []
}>()

const goods = computed<PopupGoods>(() => ({
  title: props.title,
  thumb: props.thumb,
  price: props.price,
  hideKey: {
    originPrice: true,
    tags: true,
    specs: true,
    num: true,
  },
}))

function onClose() {
  emit('close')
}

function onCloseOver() {
  emit('closeover')
}

defineExpose({
  goods,
  onClose,
  onCloseOver,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
    'goods-card': '../../components/goods-card/index',
  },
})
</script>

<template>
  <t-popup :visible="show" placement="bottom" :z-index="zIndex" @visible-change="onClose">
    <view class="specs-popup w-screen box-border p-[32rpx_32rpx_calc(20rpx+env(safe-area-inset-bottom))_32rpx] max-h-[80vh] flex flex-col bg-white rounded-[20rpx_20rpx_0_0] [&_.section]:mt-[44rpx] [&_.section]:flex-auto [&_.section]:overflow-y-scroll [&_.section]:overflow-x-hidden [&_.section]:[-webkit-overflow-scrolling:touch] [&_.section_.title]:text-[26rpx] [&_.section_.title]:text-[#4f5356] [&_.section_.options]:text-[#333333] [&_.section_.options]:text-[24rpx] [&_.section_.options]:mr-[-26rpx] [&_.section_.options_.option]:inline-block [&_.section_.options_.option]:mt-[24rpx] [&_.section_.options_.option]:h-[56rpx] [&_.section_.options_.option]:leading-[56rpx] [&_.section_.options_.option]:p-[0_16rpx] [&_.section_.options_.option]:rounded-[8rpx] [&_.section_.options_.option]:bg-[#f5f5f5] [&_.section_.options_.option]:max-w-full [&_.section_.options_.option]:box-border [&_.section_.options_.option]:truncate [&_.bottom-btn]:mt-[42rpx] [&_.bottom-btn]:relative [&_.bottom-btn]:h-[80rpx] [&_.bottom-btn]:leading-[80rpx] [&_.bottom-btn]:text-center [&_.bottom-btn]:bg-white [&_.bottom-btn]:text-[#fa4126] [&_.bottom-btn--active]:opacity-50">
      <view>
        <goods-card :data="goods" layout="horizontal-wrap" :thumb-mode="thumbMode" />
        <view class="section">
          <view class="title">
            已选规格
          </view>
          <view class="options">
            <view v-for="spec in specs" :key="spec" class="option">
              {{ spec }}
            </view>
          </view>
        </view>
      </view>
      <view class="bottom-btn" hover-class="bottom-btn--active" @tap="onClose">
        我知道了
      </view>
    </view>
  </t-popup>
</template>
