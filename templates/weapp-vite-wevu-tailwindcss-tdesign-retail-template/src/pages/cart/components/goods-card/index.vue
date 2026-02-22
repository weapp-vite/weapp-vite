<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs, useNativeInstance, watch } from 'wevu'

interface GoodsCardData {
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
  data?: GoodsCardData | null
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
  'ob': [payload: { goods: GoodsCardData, context: WechatMiniprogram.IntersectionObserver | null, ob: WechatMiniprogram.IntersectionObserverResult }]
}>()

const nativeInstance = useNativeInstance() as any
const goods = ref<GoodsCardData>({ id: '' })
const hiddenInData = ref(false)
const independentID = ref(props.id || `goods-card-${~~(Math.random() * 10 ** 8)}`)
const isValidityLinePrice = ref(false)
const { layout, centered, thumbMode, lazyLoad, pricePrefix, currency, priceFill } = toRefs(props)

let intersectionObserverContext: WechatMiniprogram.IntersectionObserver | null = null
let mounted = false

function applyGoodsState(currentGoods: GoodsCardData | null | undefined) {
  if (!currentGoods) {
    return
  }
  let validLinePrice = true
  if (currentGoods.originPrice && currentGoods.price && currentGoods.originPrice < currentGoods.price) {
    validLinePrice = false
  }
  if (currentGoods.lineClamp === undefined || currentGoods.lineClamp <= 0) {
    if ((currentGoods.tags?.length || 0) > 0 && !currentGoods.hideKey?.tags) {
      currentGoods.lineClamp = 1
    }
    else {
      currentGoods.lineClamp = 2
    }
  }
  goods.value = currentGoods
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

function intersectionObserverCB(ob: WechatMiniprogram.IntersectionObserverResult) {
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
  intersectionObserverContext.observe(`#${independentID.value}`, (ob: WechatMiniprogram.IntersectionObserverResult) => {
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
</script>

<template>
<view
  id="{{independentID}}"
  class="wr-goods-card card-class {{ layout }} {{ centered ? 'center' : ''}} [box-sizing:border-box] [font-size:24rpx] [&_.center_.wr-goods-card__main]:[align-items:flex-start] [&_.center_.wr-goods-card__main]:[justify-content:center] [&_.horizontal-wrap_.wr-goods-card__thumb]:[width:192rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:[height:192rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:[border-radius:8rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:[overflow:hidden] [&_.horizontal-wrap_.wr-goods-card__body]:[flex-direction:column] [&_.horizontal-wrap_.wr-goods-card__short_content]:[flex-direction:row] [&_.horizontal-wrap_.wr-goods-card__short_content]:[align-items:center] [&_.horizontal-wrap_.wr-goods-card__short_content]:[margin:16rpx_0_0_0] [&_.horizontal-wrap_.wr-goods-card__num]:[margin:0_0_0_auto] [&_.vertical_.wr-goods-card__main]:[padding:0_0_22rpx_0] [&_.vertical_.wr-goods-card__main]:[flex-direction:column] [&_.vertical_.wr-goods-card__thumb]:[width:340rpx] [&_.vertical_.wr-goods-card__thumb]:[height:340rpx] [&_.vertical_.wr-goods-card__body]:[margin:20rpx_20rpx_0_20rpx] [&_.vertical_.wr-goods-card__body]:[flex-direction:column] [&_.vertical_.wr-goods-card__long_content]:[overflow:hidden] [&_.vertical_.wr-goods-card__title]:[line-height:36rpx] [&_.vertical_.wr-goods-card__short_content]:[margin:20rpx_0_0_0] [&_.vertical_.wr-goods-card__price]:[order:2] [&_.vertical_.wr-goods-card__price]:[color:#fa4126] [&_.vertical_.wr-goods-card__price]:[margin:20rpx_0_0_0] [&_.vertical_.wr-goods-card__origin-price]:[order:1] [&_.vertical_.wr-goods-card__add-cart]:[position:absolute] [&_.vertical_.wr-goods-card__add-cart]:[bottom:20rpx] [&_.vertical_.wr-goods-card__add-cart]:[right:20rpx]"
  bind:tap="clickHandle"
  data-goods="{{ goods }}"
  hidden="{{hiddenInData}}"
>
	<view class="wr-goods-card__main [position:relative] [display:flex] [padding:0] [background:transparent]">
		<view class="wr-goods-card__thumb thumb-class [flex-shrink:0] [position:relative] [width:140rpx] [height:140rpx] [&:empty]:[display:none] [&:empty]:[margin:0]" bind:tap="clickThumbHandle">
			<!-- data-src 是方便加购动画读取图片用的 -->
			<t-image
			  t-class="wr-goods-card__thumb-com [width:192rpx] [height:192rpx] [border-radius:8rpx] [overflow:hidden]"
			  wx:if="{{ !!goods.thumb && !goods.hideKey.thumb }}"
			  src="{{ goods.thumb }}"
			  mode="{{ thumbMode }}"
			  lazy-load="{{ lazyLoad }}"
			/>
			<slot name="thumb-cover" />
		</view>
		<view class="wr-goods-card__body [display:flex] [margin:0_0_0_20rpx] [flex-direction:row] [flex:1_1_auto] [min-height:192rpx]">
			<view class="wr-goods-card__long_content [display:flex] [flex-direction:column] [overflow:hidden] [flex:1_1_auto] [&_.goods_tips]:[width:100%] [&_.goods_tips]:[margin-top:16rpx] [&_.goods_tips]:[text-align:right] [&_.goods_tips]:[color:#fa4126] [&_.goods_tips]:[font-size:24rpx] [&_.goods_tips]:[line-height:32rpx] [&_.goods_tips]:[font-weight:bold]">
				<view wx:if="{{ goods.title && !goods.hideKey.title }}" class="wr-goods-card__title title-class [flex-shrink:0] [font-size:28rpx] [color:#333] [line-height:40rpx] [font-weight:400] [display:-webkit-box] [-webkit-box-orient:vertical] [overflow:hidden] [word-break:break-word]" style="-webkit-line-clamp: {{ goods.lineClamp }};">
					<slot name="before-title" />
					{{ goods.title }}
				</view>
				<slot name="after-title" />
				<view wx:if="{{ goods.desc && !goods.hideKey.desc }}" class="wr-goods-card__desc desc-class [font-size:24rpx] [color:#f5f5f5] [line-height:40rpx] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow:hidden]">{{ goods.desc }}</view>
				<slot name="after-desc" />
				<view wx:if="{{ goods.specs && goods.specs.length > 0 && !goods.hideKey.specs }}" class="wr-goods-card__specs__desc specs-class [font-size:24rpx] [height:32rpx] [line-height:32rpx] [color:#999999] [margin:8rpx_0] [display:flex] [align-self:flex-start] [flex-direction:row] [background:#f5f5f5] [border-radius:8rpx] [padding:4rpx_8rpx]" bind:tap="clickSpecsHandle">
					<view class="wr-goods-card__specs__desc-text [height:100%] [max-width:380rpx] [word-break:break-all] [overflow:hidden] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]">{{ goods.specs }}</view>
					<t-icon name="chevron-down" size="32rpx" color="#999999" />
				</view>
				<view class="goods_tips" wx:if="{{goods.stockQuantity !== 0 && goods.quantity >= goods.stockQuantity}}">库存不足</view>
			</view>
			<view class="wr-goods-card__short_content [display:flex] [flex-direction:column] [justify-content:flex-start] [align-items:flex-end] [margin:0_0_0_46rpx] [&_.no_storage]:[display:flex] [&_.no_storage]:[align-items:center] [&_.no_storage]:[justify-content:space-between] [&_.no_storage]:[height:40rpx] [&_.no_storage]:[color:#333] [&_.no_storage]:[font-size:24rpx] [&_.no_storage]:[line-height:32rpx] [&_.no_storage]:[width:100%]">
				<block wx:if="{{goods.stockQuantity !== 0}}">
					<view wx:if="{{ pricePrefix }}" class="wr-goods-card__price__prefix price-prefix-class [order:0] [color:#666] [margin:0]">{{ pricePrefix }}</view>
					<slot name="price-prefix" />
					<view wx:if="{{ goods.price && !goods.hideKey.price }}" class="wr-goods-card__price [white-space:nowrap] [font-weight:bold] [order:1] [color:#fa4126] [font-size:36rpx] [margin:0] [line-height:48rpx]">
						<price
						  wr-class="price-class"
						  symbol="{{currency}}"
						  price="{{goods.price}}"
						  fill="{{priceFill}}"
						  decimalSmaller
						/>
					</view>
					<view wx:if="{{ goods.originPrice && !goods.hideKey.originPrice && isValidityLinePrice }}" class="wr-goods-card__origin-price [white-space:nowrap] [font-weight:normal] [order:2] [color:#aaaaaa] [font-size:24rpx] [margin:0]">
						<price
						  wr-class="origin-price-class"
						  symbol="{{currency}}"
						  price="{{goods.originPrice}}"
						  fill="{{priceFill}}"
						/>
					</view>
					<slot name="origin-price" />
					<view wx:if="{{goods.num && !goods.hideKey.num}}" class="wr-goods-card__num num-class [white-space:nowrap] [order:4] [font-size:24rpx] [color:#999] [margin:20rpx_0_0_auto]">
						<text class="wr-goods-card__num__prefix [color:inherit]">x </text>
						{{ goods.num }}
					</view>
				</block>
				<block wx:else>
					<view class="no_storage [&_.no_storage__right]:[width:80rpx] [&_.no_storage__right]:[height:40rpx] [&_.no_storage__right]:[border-radius:20rpx] [&_.no_storage__right]:[border:2rpx_solid_#fa4126] [&_.no_storage__right]:[line-height:40rpx] [&_.no_storage__right]:[text-align:center] [&_.no_storage__right]:[color:#fa4126]">
						<view>请重新选择商品规格</view>
						<view class="no_storage__right">重选</view>
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

<json>
{
  "component": true,
  "usingComponents": {
    "price": "/components/price/index",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-image": "/components/webp-image/index",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
