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
    <view class="specs-popup [width:100vw] [box-sizing:border-box] [padding:32rpx_32rpx_calc(20rpx_+_env(safe-area-inset-bottom))_32rpx] [max-height:80vh] [display:flex] [flex-direction:column] [background-color:white] [border-radius:20rpx_20rpx_0_0] [&_.section]:[margin-top:44rpx] [&_.section]:[flex:auto] [&_.section]:[overflow-y:scroll] [&_.section]:[overflow-x:hidden] [&_.section]:[-webkit-overflow-scrolling:touch] [&_.section_.title]:[font-size:26rpx] [&_.section_.title]:[color:#4f5356] [&_.section_.options]:[color:#333333] [&_.section_.options]:[font-size:24rpx] [&_.section_.options]:[margin-right:-26rpx] [&_.section_.options_.option]:[display:inline-block] [&_.section_.options_.option]:[margin-top:24rpx] [&_.section_.options_.option]:[height:56rpx] [&_.section_.options_.option]:[line-height:56rpx] [&_.section_.options_.option]:[padding:0_16rpx] [&_.section_.options_.option]:[border-radius:8rpx] [&_.section_.options_.option]:[background-color:#f5f5f5] [&_.section_.options_.option]:[max-width:100%] [&_.section_.options_.option]:[box-sizing:border-box] [&_.section_.options_.option]:[white-space:nowrap] [&_.section_.options_.option]:[overflow:hidden] [&_.section_.options_.option]:[text-overflow:ellipsis] [&_.bottom-btn]:[margin-top:42rpx] [&_.bottom-btn]:[position:relative] [&_.bottom-btn]:[height:80rpx] [&_.bottom-btn]:[line-height:80rpx] [&_.bottom-btn]:[text-align:center] [&_.bottom-btn]:[background-color:white] [&_.bottom-btn]:[color:#fa4126] [&_.bottom-btn--active]:[opacity:0.5]">
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
