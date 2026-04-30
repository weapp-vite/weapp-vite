<script setup lang="ts">
import { computed } from 'wevu'
import { wpi } from 'wevu/api'

interface RawGoodsItem {
  id?: number | string
  goodsName?: string
  title?: string
  image?: string
  imgUrl?: string
  payPrice?: string | number
  price?: string | number
  quantity?: number
  num?: number
  skuSpecLst?: Array<{ specValue?: string }>
}

interface RawGoodsGroupItem {
  id?: number | string
  storeName?: string
  unSettlementGoods?: RawGoodsItem[]
}

interface SettleDetailData {
  limitGoodsList?: RawGoodsGroupItem[]
  abnormalDeliveryGoodsList?: RawGoodsGroupItem[]
  inValidGoodsList?: RawGoodsGroupItem[]
  outOfStockGoodsList?: RawGoodsGroupItem[]
  storeGoodsList?: unknown[]
}

interface NormalizedGoodsItem extends RawGoodsItem {
  id: number | string
  title: string
  thumb: string
  price: string | number
  num: number
  specs: string[]
}

interface NormalizedGoodsGroupItem {
  id: number | string
  storeName?: string
  unSettlementGoods: NormalizedGoodsItem[]
}

const props = withDefaults(defineProps<{
  settleDetailData?: SettleDetailData
}>(), {
  settleDetailData: () => ({}),
})

const emit = defineEmits<{
  change: []
}>()

function pickGoodsList(data: SettleDetailData) {
  const candidates = [
    data.limitGoodsList,
    data.abnormalDeliveryGoodsList,
    data.inValidGoodsList,
    data.outOfStockGoodsList,
  ]
  return candidates.find(list => Array.isArray(list) && list.length > 0) || []
}

function normalizeGoodsItem(goods: RawGoodsItem, index: number): NormalizedGoodsItem {
  return {
    ...goods,
    id: goods.id ?? index,
    title: goods.title || goods.goodsName || '',
    thumb: goods.imgUrl || goods.image || '',
    price: goods.price || goods.payPrice || '0',
    num: goods.num || goods.quantity || 0,
    specs: (goods.skuSpecLst || []).map(spec => spec.specValue || '').filter(Boolean),
  }
}

function normalizeGoodsGroup(item: RawGoodsGroupItem, index: number): NormalizedGoodsGroupItem {
  const rawGoodsList = Array.isArray(item.unSettlementGoods) && item.unSettlementGoods.length > 0
    ? item.unSettlementGoods
    : [item as RawGoodsItem]

  return {
    id: item.id ?? index,
    storeName: item.storeName,
    unSettlementGoods: rawGoodsList.map((goods, goodsIndex) => normalizeGoodsItem(goods, goodsIndex)),
  }
}

function isOnlyBack(data: SettleDetailData) {
  return Boolean(
    (data.limitGoodsList && data.limitGoodsList.length > 0)
    || ((data.inValidGoodsList && data.inValidGoodsList.length > 0) && !data.storeGoodsList),
  )
}

function isShowChangeAddress(data: SettleDetailData) {
  return Boolean(data.abnormalDeliveryGoodsList && data.abnormalDeliveryGoodsList.length > 0)
}

function isShowKeepPay(data: SettleDetailData) {
  return Boolean(
    (data.outOfStockGoodsList && data.outOfStockGoodsList.length > 0)
    || ((data.storeGoodsList && (data.inValidGoodsList && data.inValidGoodsList.length > 0))),
  )
}

const goodsList = computed(() => pickGoodsList(props.settleDetailData).map((goods, index) => normalizeGoodsGroup(goods, index)))

async function onCard(e: { currentTarget?: { dataset?: { item?: string } } }) {
  const item = e.currentTarget?.dataset?.item
  if (item === 'cart') {
    await wpi.switchTab({
      url: '/pages/cart/index',
    })
    return
  }
  if (item === 'orderSure') {
    emit('change')
  }
}

async function onDelive() {
  await wpi.navigateTo({
    url: '/pages/user/address/list/index?selectMode=1&isOrderSure=1',
  })
}

function upper() {}

function lower() {}

function scroll() {}

defineComponentJson({
  component: true,
  usingComponents: {
    'wr-order-card': '/pages/order/components/order-card/index',
    'wr-goods-card': '/components/goods-card/index',
    'wr-order-goods-card': '/pages/order/components/order-goods-card/index',
  },
})
</script>

<template>
  <view class="goods-fail block [background:#fff] text-[30rpx] rounded-[20rpx_20rpx_0_0] [&_.title]:inline-block [&_.title]:w-full [&_.title]:text-center [&_.title]:mt-[30rpx] [&_.title]:leading-[42rpx] [&_.title]:[font-weight:bold] [&_.title]:text-[32rpx] [&_.info]:block [&_.info]:text-[26rpx] [&_.info]:font-normal [&_.info]:leading-[36rpx] [&_.info]:m-[20rpx_auto_10rpx] [&_.info]:text-center [&_.info]:w-[560rpx] [&_.info]:text-[#999] [&_.goods-fail-btn]:flex [&_.goods-fail-btn]:p-[30rpx] [&_.goods-fail-btn]:justify-between [&_.goods-fail-btn]:items-center [&_.goods-fail-btn]:text-[30rpx] [&_.goods-fail-btn_.btn]:w-[330rpx] [&_.goods-fail-btn_.btn]:h-[80rpx] [&_.goods-fail-btn_.btn]:leading-[80rpx] [&_.goods-fail-btn_.btn]:rounded-[8rpx] [&_.goods-fail-btn_.btn]:text-center [&_.goods-fail-btn_.btn]:[border:1rpx_solid_#999] [&_.goods-fail-btn_.btn]:[background:#fff] [&_.goods-fail-btn_.btn]:text-[32rpx] [&_.goods-fail-btn_.btn]:text-[#666] [&_.goods-fail-btn_.btn_.origin]:text-(--color-primary,#fa550f) [&_.goods-fail-btn_.btn_.origin]:[border:1rpx_solid_var(--color-primary,#fa550f)] [&_.goods-fail-btn_.btn_.limit]:text-(--color-primary,#fa550f) [&_.goods-fail-btn_.btn_.limit]:[border:1rpx_solid_var(--color-primary,#fa550f)] [&_.goods-fail-btn_.btn_.limit]:grow">
    <block v-if="settleDetailData.limitGoodsList && settleDetailData.limitGoodsList.length > 0">
      <view class="title">
        限购商品信息
      </view>
      <view class="info">
        以下商品限购数量，建议您修改商品数量
      </view>
    </block>
    <block
      v-else-if="settleDetailData.abnormalDeliveryGoodsList && settleDetailData.abnormalDeliveryGoodsList.length > 0"
    >
      <view class="title">
        不支持配送
      </view>
      <view class="info">
        以下店铺的商品不支持配送，请更改地址或去掉对应店铺商品再进行结算
      </view>
    </block>
    <block v-else-if="isShowKeepPay(settleDetailData)">
      <view class="title">
        部分商品库存不足或失效
      </view>
      <view class="info">
        请返回购物车重新选择商品，如果继续结算将自动忽略库存不足或失效的商品。
      </view>
    </block>
    <block v-else-if="settleDetailData.inValidGoodsList && settleDetailData.inValidGoodsList.length > 0">
      <view class="title">
        全部商品库存不足或失效
      </view>
      <view class="info">
        请返回购物车重新选择商品
      </view>
    </block>
    <scroll-view
      scroll-y="true"
      style="max-height: 500rpx"
      @scrolltoupper="upper"
      @scrolltolower="lower"
      @scroll="scroll"
    >
      <view v-for="(goods, index) in goodsList" :key="goods.id || index" class="goods-list">
        <wr-order-card v-if="goods" :order="goods">
          <wr-order-goods-card
            v-for="(goodsItem, gIndex) in goods.unSettlementGoods"
            :key="goodsItem.id || gIndex"
            :goods="goodsItem"
            :no-top-line="gIndex === 0"
          />
        </wr-order-card>
      </view>
    </scroll-view>
    <view class="goods-fail-btn">
      <view data-item="cart" :class="`btn ${isOnlyBack(settleDetailData) ? 'limit' : ''}`" @tap="onCard">
        返回购物车
      </view>
      <view v-if="isShowChangeAddress(settleDetailData)" class="btn origin" @tap="onDelive">
        修改配送地址
      </view>
      <view v-else-if="isShowKeepPay(settleDetailData)" data-item="orderSure" class="btn origin" @tap="onCard">
        继续结算
      </view>
    </view>
  </view>
</template>
