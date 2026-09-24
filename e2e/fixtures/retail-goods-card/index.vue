<script setup lang="ts">
import { nextTick, ref } from 'wevu'

interface GoodsClickDetail {
  goods: { id: string }
}

const cardIds = ref({ cart: 'retail-cart-explicit', order: 'retail-order-explicit', specs: 'retail-specs-explicit' })
const lastClick = ref('none')
const goods = {
  id: 'retail-business-goods',
  title: '商品标识保留',
  hideKey: { thumb: true, desc: true, specs: true, price: true, originPrice: true, num: true, tags: true },
}

async function updateCardIds() {
  cardIds.value = { cart: 'retail-cart-updated', order: 'retail-order-updated', specs: 'retail-specs-updated' }
  await nextTick()
}

async function clearCardIds() {
  cardIds.value = { cart: '', order: '', specs: '' }
  await nextTick()
}

function recordClick(source: string, payload: GoodsClickDetail) {
  lastClick.value = `${source}:${payload.goods.id}`
}

defineExpose({ updateCardIds, clearCardIds })

definePageJson({
  navigationBarTitleText: '商品卡片标识回归',
  usingComponents: {
    'cart-goods-card': '/pages/cart/components/goods-card/index',
    'order-goods-card': '../components/goods-card/index',
    'specs-goods-card': '../components/specs-goods-card/index',
  },
})
</script>

<template>
  <view>
    <text id="retail-goods-last-click">{{ lastClick }}</text>
    <view id="retail-cart-explicit-host">
      <cart-goods-card :card-id="cardIds.cart" :data="goods" @click="recordClick('cart', $event)" />
    </view>
    <view id="retail-order-explicit-host">
      <order-goods-card :card-id="cardIds.order" :data="goods" @click="recordClick('order', $event)" />
    </view>
    <view id="retail-specs-explicit-host">
      <specs-goods-card :card-id="cardIds.specs" :data="goods" @click="recordClick('specs', $event)" />
    </view>
    <view id="retail-cart-default-host">
      <cart-goods-card :data="goods" />
    </view>
    <view id="retail-order-default-host">
      <order-goods-card :data="goods" />
    </view>
    <view id="retail-specs-default-host">
      <specs-goods-card :data="goods" />
    </view>
  </view>
</template>
