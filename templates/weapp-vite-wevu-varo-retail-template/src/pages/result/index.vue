<script setup lang="ts">
import type { Order } from '@/shop'
import { onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'
import VEmpty from '@/components/ui/empty.vue'
import VButton from '@/components/ui/v-button.vue'
import VIcon from '@/components/ui/v-icon.vue'
import { formatPrice, getOrder } from '@/shop'

definePageJson({
  navigationBarTitleText: '订单结果',
  backgroundColor: '#f5f5eb',
})

const order = ref<Order>()

onLoad((query: { id?: string } = {}) => {
  if (query.id) {
    order.value = getOrder(query.id)
  }
})

function openOrders() {
  void wpi.navigateTo({ url: '/pages/orders/index' })
}

function openShop() {
  void wpi.switchTab({ url: '/pages/home/index' })
}
</script>

<template>
  <view class="shop-page">
    <template v-if="order">
      <view class="shop-success">
        <view class="shop-success__icon">
          <VIcon name="success" :size="26" />
        </view>
        <text class="shop-heading">
          模拟下单成功
        </text>
        <text class="shop-subheading">
          可在订单列表里查看这条本地记录。
        </text>
      </view>

      <view class="shop-panel">
        <view class="shop-row">
          <text>{{ order.id }}</text>
          <text class="shop-muted">
            模拟订单
          </text>
        </view>
        <view class="shop-row">
          <text>{{ order.lines.length }} 种商品</text>
          <text class="shop-price">
            {{ formatPrice(order.total) }}
          </text>
        </view>
      </view>

      <view class="shop-result__actions">
        <VButton @click="openOrders">
          查看订单
        </VButton>
        <VButton variant="outline" @click="openShop">
          继续逛店
        </VButton>
      </view>
    </template>

    <VEmpty
      v-else
      class="shop-empty"
      icon="info"
      title="没有找到订单"
      description="这条本地记录可能已经被清理。"
    >
      <VButton @click="openOrders">
        查看订单列表
      </VButton>
    </VEmpty>
  </view>
</template>

<style>
.shop-success {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: flex-start;
  padding: 58rpx 0 36rpx;
}

.shop-success__icon {
  display: grid;
  place-items: center;
  width: 92rpx;
  height: 92rpx;
  color: var(--shop-accent);
  background: var(--shop-accent-soft);
  border-radius: 999rpx;
}

.shop-result__actions {
  display: flex;
  gap: 14rpx;
  margin-top: 28rpx;
}
</style>
