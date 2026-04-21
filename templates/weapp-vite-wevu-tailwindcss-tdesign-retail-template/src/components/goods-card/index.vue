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
const nativeInstance = useNativeInstance()

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
  const observer = nativeInstance.createIntersectionObserver?.({
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

defineComponentJson({
  component: true,
  usingComponents: {
    'price': '/components/price/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <view
    :id="independentID"
    class="goods-card box-border text-[24rpx] rounded-[0_0_16rpx_16rpx] [border-bottom:none]"
    :data-goods="goods"
    @tap="clickHandle"
  >
    <view class="goods-card__main relative flex leading-none p-0 [background:transparent] w-[342rpx] rounded-[0_0_16rpx_16rpx] items-center justify-center mb-[16rpx] flex-col">
      <view class="goods-card__thumb shrink-0 relative size-[340rpx] empty:hidden empty:m-0" @tap="clickThumbHandle">
        <t-image
          v-if="!!goods.thumb"
          t-class="goods-card__img [display:block] [width:100%] [height:100%] [border-radius:16rpx_16rpx_0_0] [overflow:hidden]"
          :src="goods.thumb"
          mode="aspectFill"
          lazy-load
        />
      </view>
      <view class="goods-card__body flex flex-[1_1_auto] [background:#fff] rounded-[0_0_16rpx_16rpx] p-[16rpx_24rpx_18rpx] flex-col">
        <view class="goods-card__upper flex flex-col overflow-hidden flex-[1_1_auto]">
          <view v-if="goods.title" class="goods-card__title shrink-0 text-[28rpx] text-[#333] font-normal line-clamp-2 h-[72rpx] [word-break:break-word] leading-[36rpx]">
            {{ goods.title }}
          </view>
          <view v-if="goods.tags && !!goods.tags.length" class="goods-card__tags flex flex-row flex-wrap m-[8rpx_0_0_0]">
            <view
              v-for="(tag, index) in goods.tags"
              :key="index"
              class="goods-card__tag text-[#fa4126] [background:transparent] text-[20rpx] [border:1rpx_solid_#fa4126] p-[0_8rpx] rounded-[16rpx] leading-[30rpx] m-[0_8rpx_8rpx_0] block truncate break-keep"
              :data-index="index"
            >
              {{ tag }}
            </view>
          </view>
        </view>
        <view class="goods-card__down flex relative flex-row justify-start items-baseline leading-[32rpx] m-[8rpx_0_0_0]">
          <price
            v-if="goods.price"
            wr-class="spec-for-price [font-size:36rpx] [white-space:nowrap] [font-weight:700] [order:1] [color:#fa4126] [margin:0]"
            symbol-class="spec-for-symbol [font-size:24rpx]"
            :symbol="currency"
            :price="goods.price"
          />
          <price
            v-if="goods.originPrice && isValidityLinePrice"
            wr-class="goods-card__origin-price [white-space:nowrap] [font-weight:700] [order:2] [color:#bbbbbb] [font-size:24rpx] [margin:0_0_0_8rpx]"
            :symbol="currency"
            :price="goods.originPrice"
            type="delthrough"
          />
          <t-icon
            :id="`${independentID}-cart`"
            class="goods-card__add-cart order-3 m-[auto_0_0_auto] absolute bottom-0 right-0"
            prefix="wr"
            name="cartAdd"
            :data-id="independentID"
            size="48rpx"
            color="#FA550F"
            @tap.stop="addCartHandle"
          />
        </view>
      </view>
    </view>
  </view>
</template>
