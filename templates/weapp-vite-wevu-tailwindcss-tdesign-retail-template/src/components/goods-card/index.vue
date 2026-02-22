<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, useNativeInstance, watch } from 'wevu'

interface GoodsCardData {
  id?: string
  thumb?: string
  title?: string
  tags?: string[]
  price?: number
  originPrice?: number
  [key: string]: any
}

defineOptions({
  setupLifecycle: 'created',
  options: {
    addGlobalClass: true,
  },
  pageLifeTimes: {},
})

const props = withDefaults(defineProps<{
  id?: string
  data?: GoodsCardData | null
  currency?: string
  thresholds?: number[]
}>(), {
  id: '',
  data: () => ({ id: '' }),
  currency: '¥',
  thresholds: () => [],
})

const emit = defineEmits<{
  'click': [payload: { goods: GoodsCardData }]
  'thumb': [payload: { goods: GoodsCardData }]
  'add-cart': [payload: Record<string, any>]
  'ob': [payload: { goods: GoodsCardData, context: WechatMiniprogram.IntersectionObserver | null }]
}>()

const goods = computed<GoodsCardData>(() => props.data || { id: '' })
const isValidityLinePrice = computed(() => {
  const current = goods.value
  return !(current.originPrice && current.price && current.originPrice < current.price)
})
const independentID = ref(props.id || `goods-card-${~~(Math.random() * 10 ** 8)}`)
const { currency } = toRefs(props)

let intersectionObserverContext: WechatMiniprogram.IntersectionObserver | null = null

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

function genIndependentID(id: string) {
  if (id) {
    independentID.value = id
    return
  }
  if (!independentID.value) {
    independentID.value = `goods-card-${~~(Math.random() * 10 ** 8)}`
  }
}

function intersectionObserverCB() {
  emit('ob', {
    goods: goods.value,
    context: intersectionObserverContext,
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
  const native = useNativeInstance() as any
  const observer = native.createIntersectionObserver?.({
    thresholds: props.thresholds,
  })?.relativeToViewport?.()
  if (!observer) {
    return
  }
  intersectionObserverContext = observer
  intersectionObserverContext.observe(`#${independentID.value}`, () => {
    intersectionObserverCB()
  })
}

watch(
  () => props.id,
  (id) => {
    genIndependentID(id || '')
    clearIntersectionObserverHandle()
    createIntersectionObserverHandle()
  },
)

watch(
  () => props.thresholds,
  () => {
    clearIntersectionObserverHandle()
    createIntersectionObserverHandle()
  },
  {
    deep: true,
  },
)

onMounted(() => {
  genIndependentID(props.id || '')
  createIntersectionObserverHandle()
})

onUnmounted(() => {
  clearIntersectionObserverHandle()
})

defineExpose({
  currency,
  goods,
  isValidityLinePrice,
  independentID,
  clickHandle,
  clickThumbHandle,
  addCartHandle,
})
</script>

<template>
  <view
    id="{{independentID}}"
    class="goods-card [box-sizing:border-box] [font-size:24rpx] [border-radius:0_0_16rpx_16rpx] [border-bottom:none]"
    bind:tap="clickHandle"
    data-goods="{{ goods }}"
  >
    <view class="goods-card__main [position:relative] [display:flex] [line-height:1] [padding:0] [background:transparent] [width:342rpx] [border-radius:0_0_16rpx_16rpx] [align-items:center] [justify-content:center] [margin-bottom:16rpx] [flex-direction:column]">
      <view class="goods-card__thumb [flex-shrink:0] [position:relative] [width:340rpx] [height:340rpx] [&:empty]:[display:none] [&:empty]:[margin:0]" bind:tap="clickThumbHandle">
        <t-image
          wx:if="{{ !!goods.thumb }}"
          t-class="goods-card__img [display:block] [width:100%] [height:100%] [border-radius:16rpx_16rpx_0_0] [overflow:hidden]"
          src="{{ goods.thumb }}"
          mode="aspectFill"
          lazy-load
        />
      </view>
      <view class="goods-card__body [display:flex] [flex:1_1_auto] [background:#fff] [border-radius:0_0_16rpx_16rpx] [padding:16rpx_24rpx_18rpx] [flex-direction:column]">
        <view class="goods-card__upper [display:flex] [flex-direction:column] [overflow:hidden] [flex:1_1_auto]">
          <view wx:if="{{ goods.title }}" class="goods-card__title [flex-shrink:0] [font-size:28rpx] [color:#333] [font-weight:400] [display:-webkit-box] [height:72rpx] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow:hidden] [word-break:break-word] [line-height:36rpx]">
            {{ goods.title }}
          </view>
          <view wx:if="{{ goods.tags && !!goods.tags.length }}" class="goods-card__tags [display:flex] [flex-direction:row] [flex-wrap:wrap] [margin:8rpx_0_0_0]">
            <view
              wx:for="{{ goods.tags }}"
              wx:key="index"
              wx:for-item="tag"
              class="goods-card__tag [color:#fa4126] [background:transparent] [font-size:20rpx] [border:1rpx_solid_#fa4126] [padding:0_8rpx] [border-radius:16rpx] [line-height:30rpx] [margin:0_8rpx_8rpx_0] [display:block] [overflow:hidden] [white-space:nowrap] [word-break:keep-all] [text-overflow:ellipsis]"
              data-index="{{index}}"
            >
              {{ tag }}
            </view>
          </view>
        </view>
        <view class="goods-card__down [display:flex] [position:relative] [flex-direction:row] [justify-content:flex-start] [align-items:baseline] [line-height:32rpx] [margin:8rpx_0_0_0]">
          <price
            wx:if="{{ goods.price }}"
            wr-class="spec-for-price [font-size:36rpx] [white-space:nowrap] [font-weight:700] [order:1] [color:#fa4126] [margin:0]"
            symbol-class="spec-for-symbol [font-size:24rpx]"
            symbol="{{currency}}"
            price="{{goods.price}}"
          />
          <price
            wx:if="{{ goods.originPrice && isValidityLinePrice }}"
            wr-class="goods-card__origin-price [white-space:nowrap] [font-weight:700] [order:2] [color:#bbbbbb] [font-size:24rpx] [margin:0_0_0_8rpx]"
            symbol="{{currency}}"
            price="{{goods.originPrice}}"
            type="delthrough"
          />
          <t-icon
            id="{{independentID}}-cart"
            class="goods-card__add-cart [order:3] [margin:auto_0_0_auto] [position:absolute] [bottom:0] [right:0]"
            prefix="wr"
            name="cartAdd"
            data-id="{{independentID}}"
            catchtap="addCartHandle"
            size="48rpx"
            color="#FA550F"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<json>
{
    "component": true,
    "usingComponents": {
        "price": "/components/price/index",
        "t-icon": "tdesign-miniprogram/icon/icon",
        "t-image": "/components/webp-image/index"
    }
}
</json>
