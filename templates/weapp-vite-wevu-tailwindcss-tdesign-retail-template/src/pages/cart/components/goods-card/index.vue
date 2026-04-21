<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs, useNativeInstance, watch } from 'wevu'

interface InputGoodsCardData {
  id?: string
  title?: string
  desc?: string
  thumb?: string
  tags?: string[]
  specs?: string
  hideKey?: Record<string, boolean>
  originPrice?: number
  price?: number
  lineClamp?: number
  num?: number
  stockQuantity?: number
  quantity?: number
  [key: string]: any
}

interface GoodsCardData extends InputGoodsCardData {
  title: string
  desc: string
  thumb: string
  tags: string[]
  specs: string
  hideKey: Record<string, boolean>
  originPrice: number
  price: number
  lineClamp: number
  num: number
  stockQuantity: number
  quantity: number
}

type IntersectionObserverObserveResult = Parameters<WechatMiniprogram.IntersectionObserver['observe']>[1] extends (result: infer T) => void ? T : unknown

defineOptions({
  setupLifecycle: 'created',
  options: {
    multipleSlots: true,
    addGlobalClass: true,
  },
  externalClasses: ['card-class', 'title-class', 'desc-class', 'num-class', 'thumb-class', 'specs-class', 'price-class', 'origin-price-class', 'price-prefix-class'],
})

const props = withDefaults(defineProps<{
  hidden?: boolean | null
  id?: string
  data?: InputGoodsCardData | null
  layout?: string
  thumbMode?: string
  priceFill?: boolean
  currency?: string
  lazyLoad?: boolean
  centered?: boolean
  pricePrefix?: string
  thresholds?: number[]
  specsIconClassPrefix?: string
  specsIcon?: string
  addCartIconClassPrefix?: string
  addCartIcon?: string
}>(), {
  hidden: false,
  id: '',
  data: () => ({ id: '' }),
  layout: 'horizontal',
  thumbMode: 'aspectFill',
  priceFill: true,
  currency: '¥',
  lazyLoad: false,
  centered: false,
  pricePrefix: '',
  thresholds: () => [],
  specsIconClassPrefix: 'wr',
  specsIcon: 'expand_more',
  addCartIconClassPrefix: 'wr',
  addCartIcon: 'cart',
})

const emit = defineEmits<{
  'click': [payload: { goods: GoodsCardData }]
  'thumb': [payload: { goods: GoodsCardData }]
  'specs': [payload: { goods: GoodsCardData }]
  'tag': [payload: { goods: GoodsCardData, index: number }]
  'add-cart': [payload: Record<string, any>]
  'ob': [payload: { goods: GoodsCardData, context: WechatMiniprogram.IntersectionObserver | null, ob: IntersectionObserverObserveResult }]
}>()

const nativeInstance = useNativeInstance()
const goods = ref<GoodsCardData>({
  id: '',
  title: '',
  desc: '',
  thumb: '',
  tags: [],
  specs: '',
  hideKey: {
    title: false,
    thumb: false,
    desc: false,
    specs: false,
    price: false,
    originPrice: false,
    num: false,
    tags: false,
  },
  originPrice: 0,
  price: 0,
  lineClamp: 2,
  num: 0,
  stockQuantity: 0,
  quantity: 0,
})
const hiddenInData = ref(false)
const independentID = ref(props.id || `goods-card-${~~(Math.random() * 10 ** 8)}`)
const isValidityLinePrice = ref(false)

const { layout, centered, thumbMode, lazyLoad, pricePrefix, currency, priceFill } = toRefs(props)

let intersectionObserverContext: WechatMiniprogram.IntersectionObserver | null = null
let mounted = false

function applyGoodsState(currentGoods: InputGoodsCardData | null | undefined) {
  if (!currentGoods) {
    return
  }
  const nextGoods: GoodsCardData = {
    ...goods.value,
    ...currentGoods,
    title: currentGoods.title ?? '',
    desc: currentGoods.desc ?? '',
    thumb: currentGoods.thumb ?? '',
    tags: currentGoods.tags ?? [],
    specs: currentGoods.specs ?? '',
    hideKey: {
      ...goods.value.hideKey,
      ...currentGoods.hideKey,
    },
    originPrice: currentGoods.originPrice ?? 0,
    price: currentGoods.price ?? 0,
    lineClamp: currentGoods.lineClamp ?? 0,
    num: currentGoods.num ?? 0,
    stockQuantity: currentGoods.stockQuantity ?? 0,
    quantity: currentGoods.quantity ?? 0,
  }
  let validLinePrice = true
  if (nextGoods.originPrice && nextGoods.price && nextGoods.originPrice < nextGoods.price) {
    validLinePrice = false
  }
  if (nextGoods.lineClamp <= 0) {
    if (nextGoods.tags.length > 0 && !nextGoods.hideKey.tags) {
      nextGoods.lineClamp = 1
    }
    else {
      nextGoods.lineClamp = 2
    }
  }
  goods.value = nextGoods
  isValidityLinePrice.value = validLinePrice
}

function clickHandle() {
  emit('click', {
    goods: goods.value,
  })
}

function clickThumbHandle() {
  emit('thumb', {
    goods: goods.value,
  })
}

function clickSpecsHandle() {
  emit('specs', {
    goods: goods.value,
  })
}

function clickTagHandle(evt: any) {
  const index = Number(evt?.currentTarget?.dataset?.index ?? 0)
  emit('tag', {
    goods: goods.value,
    index,
  })
}

function addCartHandle(e: any) {
  const { id } = e.currentTarget
  const { id: cardID } = e.currentTarget.dataset
  emit('add-cart', {
    ...e.detail,
    id,
    cardID,
    goods: goods.value,
  })
}

function genIndependentID(id = '') {
  if (id) {
    independentID.value = id
    return
  }
  independentID.value = `goods-card-${~~(Math.random() * 10 ** 8)}`
}

function setHidden(hidden: boolean) {
  hiddenInData.value = !!hidden
}

function intersectionObserverCB(ob: IntersectionObserverObserveResult) {
  emit('ob', {
    goods: goods.value,
    context: intersectionObserverContext,
    ob,
  })
}

function clearIntersectionObserverHandle() {
  if (!intersectionObserverContext) {
    return
  }
  try {
    intersectionObserverContext.disconnect()
  }
  catch {
    // ignore disconnect error
  }
  intersectionObserverContext = null
}

function createIntersectionObserverHandle() {
  if (intersectionObserverContext || !independentID.value || !props.thresholds?.length) {
    return
  }
  const observer = nativeInstance.createIntersectionObserver?.({
    thresholds: props.thresholds,
  })?.relativeToViewport?.()
  if (!observer) {
    return
  }
  intersectionObserverContext = observer
  intersectionObserverContext.observe(`#${independentID.value}`, (ob: IntersectionObserverObserveResult) => {
    intersectionObserverCB(ob)
  })
}

watch(
  () => props.hidden,
  (hidden) => {
    if (hidden !== null) {
      setHidden(!!hidden)
    }
  },
  { immediate: true },
)

watch(
  () => props.data,
  (currentGoods) => {
    applyGoodsState(currentGoods)
  },
  {
    immediate: true,
    deep: true,
  },
)

watch(
  () => props.id,
  (id) => {
    genIndependentID(id || '')
    if (!mounted) {
      return
    }
    clearIntersectionObserverHandle()
    createIntersectionObserverHandle()
  },
)

watch(
  () => props.thresholds,
  () => {
    if (!mounted) {
      return
    }
    clearIntersectionObserverHandle()
    createIntersectionObserverHandle()
  },
  {
    deep: true,
  },
)

onMounted(() => {
  mounted = true
  genIndependentID(props.id || '')
  createIntersectionObserverHandle()
})

onUnmounted(() => {
  clearIntersectionObserverHandle()
})

defineExpose({
  goods,
  hiddenInData,
  independentID,
  isValidityLinePrice,
  clickHandle,
  clickThumbHandle,
  clickSpecsHandle,
  clickTagHandle,
  addCartHandle,
})

defineComponentJson({
  component: true,
  usingComponents: {
    'price': '/components/price/index',
    't-tag': 'tdesign-miniprogram/tag/tag',
    't-image': '/components/webp-image/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view
    :id="independentID"
    :class="`wr-goods-card card-class ${layout} ${centered ? 'center' : ''} box-border text-[24rpx] [&_.center_.wr-goods-card__main]:items-start [&_.center_.wr-goods-card__main]:justify-center [&_.horizontal-wrap_.wr-goods-card__thumb]:size-[192rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:rounded-[8rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:overflow-hidden [&_.horizontal-wrap_.wr-goods-card__body]:flex-col [&_.horizontal-wrap_.wr-goods-card__short_content]:flex-row [&_.horizontal-wrap_.wr-goods-card__short_content]:items-center [&_.horizontal-wrap_.wr-goods-card__short_content]:m-[16rpx_0_0_0] [&_.horizontal-wrap_.wr-goods-card__num]:m-[0_0_0_auto] [&_.vertical_.wr-goods-card__main]:p-[0_0_22rpx_0] [&_.vertical_.wr-goods-card__main]:flex-col [&_.vertical_.wr-goods-card__thumb]:size-[340rpx] [&_.vertical_.wr-goods-card__body]:m-[20rpx_20rpx_0_20rpx] [&_.vertical_.wr-goods-card__body]:flex-col [&_.vertical_.wr-goods-card__long_content]:overflow-hidden [&_.vertical_.wr-goods-card__title]:leading-[36rpx] [&_.vertical_.wr-goods-card__short_content]:m-[20rpx_0_0_0] [&_.vertical_.wr-goods-card__price]:order-2 [&_.vertical_.wr-goods-card__price]:text-[#fa4126] [&_.vertical_.wr-goods-card__price]:m-[20rpx_0_0_0] [&_.vertical_.wr-goods-card__origin-price]:order-1 [&_.vertical_.wr-goods-card__add-cart]:absolute [&_.vertical_.wr-goods-card__add-cart]:bottom-[20rpx] [&_.vertical_.wr-goods-card__add-cart]:right-[20rpx]`"
    :data-goods="goods"
    :hidden="hiddenInData"
    @tap="clickHandle"
  >
    <view class="wr-goods-card__main relative flex p-0 [background:transparent]">
      <view class="wr-goods-card__thumb thumb-class shrink-0 relative size-[140rpx] empty:hidden empty:m-0" @tap="clickThumbHandle">
        <!-- data-src 是方便加购动画读取图片用的 -->
        <t-image
          v-if="!!goods.thumb && !goods.hideKey.thumb"
          t-class="wr-goods-card__thumb-com [width:192rpx] [height:192rpx] [border-radius:8rpx] [overflow:hidden]"
          :src="goods.thumb"
          :mode="thumbMode"
          :lazy-load="lazyLoad"
        />
        <slot name="thumb-cover" />
      </view>
      <view class="wr-goods-card__body flex m-[0_0_0_20rpx] flex-row flex-[1_1_auto] min-h-[192rpx]">
        <view class="wr-goods-card__long_content flex flex-col overflow-hidden flex-[1_1_auto] [&_.goods_tips]:w-full [&_.goods_tips]:mt-[16rpx] [&_.goods_tips]:text-right [&_.goods_tips]:text-[#fa4126] [&_.goods_tips]:text-[24rpx] [&_.goods_tips]:leading-[32rpx] [&_.goods_tips]:[font-weight:bold]">
          <view v-if="goods.title && !goods.hideKey.title" class="wr-goods-card__title title-class shrink-0 text-[28rpx] text-[#333] leading-[40rpx] font-normal [display:-webkit-box] [-webkit-box-orient:vertical] overflow-hidden [word-break:break-word]" :style="`-webkit-line-clamp: ${goods.lineClamp};`">
            <slot name="before-title" />
            {{ goods.title }}
          </view>
          <slot name="after-title" />
          <view v-if="goods.desc && !goods.hideKey.desc" class="wr-goods-card__desc desc-class text-[24rpx] text-[#f5f5f5] leading-[40rpx] line-clamp-2">
            {{ goods.desc }}
          </view>
          <slot name="after-desc" />
          <view v-if="goods.specs && goods.specs.length > 0 && !goods.hideKey.specs" class="wr-goods-card__specs__desc specs-class text-[24rpx] h-[32rpx] leading-[32rpx] text-[#999999] m-[8rpx_0] flex self-start flex-row [background:#f5f5f5] rounded-[8rpx] p-[4rpx_8rpx]" @tap="clickSpecsHandle">
            <view class="wr-goods-card__specs__desc-text h-full max-w-[380rpx] break-all line-clamp-1">
              {{ goods.specs }}
            </view>
            <t-icon name="chevron-down" size="32rpx" color="#999999" />
          </view>
          <view v-if="goods.stockQuantity !== 0 && goods.quantity >= goods.stockQuantity" class="goods_tips">
            库存不足
          </view>
        </view>
        <view class="wr-goods-card__short_content flex flex-col justify-start items-end m-[0_0_0_46rpx] [&_.no_storage]:flex [&_.no_storage]:items-center [&_.no_storage]:justify-between [&_.no_storage]:h-[40rpx] [&_.no_storage]:text-[#333] [&_.no_storage]:text-[24rpx] [&_.no_storage]:leading-[32rpx] [&_.no_storage]:w-full">
          <block v-if="goods.stockQuantity !== 0">
            <view v-if="pricePrefix" class="wr-goods-card__price__prefix price-prefix-class order-0 text-[#666] m-0">
              {{ pricePrefix }}
            </view>
            <slot name="price-prefix" />
            <view v-if="goods.price && !goods.hideKey.price" class="wr-goods-card__price whitespace-nowrap [font-weight:bold] order-1 text-[#fa4126] text-[36rpx] m-0 leading-[48rpx]">
              <price
                wr-class="price-class"
                :symbol="currency"
                :price="goods.price"
                :fill="priceFill"
                decimalSmaller
              />
            </view>
            <view v-if="goods.originPrice && !goods.hideKey.originPrice && isValidityLinePrice" class="wr-goods-card__origin-price whitespace-nowrap [font-weight:normal] order-2 text-[#aaaaaa] text-[24rpx] m-0">
              <price
                wr-class="origin-price-class"
                :symbol="currency"
                :price="goods.originPrice"
                :fill="priceFill"
              />
            </view>
            <slot name="origin-price" />
            <view v-if="goods.num && !goods.hideKey.num" class="wr-goods-card__num num-class whitespace-nowrap order-4 text-[24rpx] text-[#999] m-[20rpx_0_0_auto]">
              <text class="wr-goods-card__num__prefix text-inherit">
                x
              </text>
              {{ goods.num }}
            </view>
          </block>
          <block v-else>
            <view class="no_storage [&_.no_storage__right]:w-[80rpx] [&_.no_storage__right]:h-[40rpx] [&_.no_storage__right]:rounded-[20rpx] [&_.no_storage__right]:[border:2rpx_solid_#fa4126] [&_.no_storage__right]:leading-[40rpx] [&_.no_storage__right]:text-center [&_.no_storage__right]:text-[#fa4126]">
              <view>请重新选择商品规格</view>
              <view class="no_storage__right">
                重选
              </view>
            </view>
          </block>
        </view>
        <slot name="append-body" />
      </view>
      <slot name="footer" />
    </view>
    <slot name="append-card" />
  </view>
</template>
