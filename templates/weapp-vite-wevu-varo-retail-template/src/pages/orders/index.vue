<script setup lang="ts">
import { wpi } from 'wevu/api'
import VEmpty from '@/components/ui/empty.vue'
import VButton from '@/components/ui/v-button.vue'
import { addresses, formatPrice, shop } from '@/shop'

definePageJson({
  navigationBarTitleText: '我的订单',
  backgroundColor: '#f5f5eb',
})

function formatCreatedAt(timestamp: number) {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function addressTitle(id: string) {
  return addresses.find(address => address.id === id)?.title ?? '示例地址'
}

function openOrder(id: string) {
  void wpi.navigateTo({ url: `/pages/result/index?id=${encodeURIComponent(id)}` })
}

function openShop() {
  void wpi.switchTab({ url: '/pages/home/index' })
}
</script>

<template>
  <view class="shop-page">
    <view v-if="shop.orders.length > 0">
      <button
        v-for="order in shop.orders"
        :key="order.id"
        class="shop-panel shop-order-card"
        :aria-label="`查看订单${order.id}`"
        @tap="openOrder(order.id)"
      >
        <view class="shop-row">
          <text class="shop-order-card__id">
            {{ order.id }}
          </text>
          <text class="shop-muted">
            本地模拟
          </text>
        </view>
        <view class="shop-row">
          <view class="shop-order-card__summary">
            <text>{{ order.lines.length }} 种商品 · {{ addressTitle(order.addressId) }}</text>
            <text class="shop-muted">
              {{ formatCreatedAt(order.createdAt) }}
            </text>
          </view>
          <text class="shop-price shop-order-card__price">
            {{ formatPrice(order.total) }}
          </text>
        </view>
      </button>
    </view>

    <VEmpty
      v-else
      class="shop-empty"
      icon="info"
      title="还没有订单"
      description="提交模拟订单后会显示在这里。"
    >
      <VButton @click="openShop">
        去选商品
      </VButton>
    </VEmpty>
  </view>
</template>

<style>
.shop-order-card {
  width: 100%;
  text-align: left;
}

.shop-order-card__id {
  max-width: 430rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  white-space: nowrap;
}

.shop-order-card__summary {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.shop-order-card__price {
  flex: 0 0 auto;
  font-size: 32rpx;
}
</style>
