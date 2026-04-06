<script setup lang="ts">
interface GoodsData {
  [key: string]: any
}

const props = withDefaults(defineProps<{
  id?: string
  hidden?: boolean | null
  data?: GoodsData | null
  layout?: string
  thumbMode?: string
  thumbWidth?: number
  thumbHeight?: number
  thumbWidthInPopup?: number
  thumbHeightInPopup?: number
  priceFill?: boolean
  currency?: string
  lazyLoad?: boolean
  centered?: boolean
  showCart?: boolean
  pricePrefix?: string
  cartSize?: number
  cartColor?: string
  disablePopup?: boolean
}>(), {
  id: '',
  hidden: false,
  data: () => ({}),
  layout: 'horizontal',
  thumbMode: 'aspectFill',
  thumbWidth: undefined,
  thumbHeight: undefined,
  thumbWidthInPopup: undefined,
  thumbHeightInPopup: undefined,
  priceFill: true,
  currency: '¥',
  lazyLoad: false,
  centered: false,
  showCart: false,
  pricePrefix: '',
  cartSize: 48,
  cartColor: '#FA550F',
  disablePopup: false,
})

const emit = defineEmits<{
  'thumb': [payload: any]
  'tag': [payload: any]
  'add-cart': [payload: any]
  'click': [payload: any]
  'specsclose': [payload: { good: GoodsData | null }]
}>()

function onClick(e: any) {
  emit('click', e)
}

function onClickThumb(e: any) {
  emit('thumb', e)
}

function onClickTag(e: any) {
  emit('tag', e)
}

function onClickCart(e: any) {
  emit('add-cart', e)
}

defineComponentJson({
  component: true,
  usingComponents: {
    'goods-card': '../goods-card/index',
  },
})
</script>

<template>
  <goods-card
    :id="id"
    class="wr-specs-goods-card"
    :layout="layout"
    :data="data"
    :currency="currency"
    :price-fill="priceFill"
    :lazy-load="lazyLoad"
    :centered="centered"
    :thumb-mode="thumbMode"
    :thumb-width="thumbWidth"
    :thumb-height="thumbHeight"
    :show-cart="showCart"
    :cart-size="cartSize"
    :cart-color="cartColor"
    card-class="wr-goods-card"
    title-class="title-class"
    desc-class="desc-class"
    num-class="num-class"
    thumb-class="thumb-class"
    specs-class="specs-class"
    price-class="price-class"
    origin-price-class="origin-price-class"
    price-prefix-class="price-prefix-class"
    :hidden="hidden"
    @thumb="onClickThumb"
    @tag="onClickTag"
    @add-cart="onClickCart"
    @click="onClick"
  >
    <slot name="thumb-cover" />
    <slot name="after-title" />
    <slot name="after-desc" />
    <slot name="price-prefix" />
    <slot name="append-body" />
    <slot name="footer" />
    <slot name="append-card" />
  </goods-card>
</template>
