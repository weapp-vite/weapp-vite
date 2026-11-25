<script setup lang="ts">
import { computed } from 'wevu'
import { wpi } from 'wevu/api'
import VIcon from '@/components/ui/v-icon.vue'
import { addresses, shop } from '@/shop'

definePageJson({
  navigationBarTitleText: '我的',
  backgroundColor: '#f5f5eb',
})

const address = computed(() => addresses.find(item => item.id === shop.addressId) ?? addresses[0])

function openOrders() {
  void wpi.navigateTo({ url: '/pages/orders/index' })
}

function openAddresses() {
  void wpi.navigateTo({ url: '/pages/address/index' })
}
</script>

<template>
  <view class="shop-page shop-profile">
    <view class="shop-profile__identity">
      <view class="shop-profile__avatar" aria-hidden="true">
        日
      </view>
      <view>
        <text class="shop-heading shop-profile__name">
          日常咖啡客
        </text>
        <text class="shop-subheading">
          本地示例用户
        </text>
      </view>
    </view>

    <view class="shop-profile__menu">
      <button class="shop-panel shop-profile__entry" aria-label="查看我的订单" @tap="openOrders">
        <view class="shop-profile__entry-copy">
          <text class="shop-panel__title">
            我的订单
          </text>
          <text class="shop-address__detail">
            {{ shop.orders.length > 0 ? `${shop.orders.length} 条本地模拟订单` : '还没有模拟订单' }}
          </text>
        </view>
        <VIcon name="chevron-right" :size="20" />
      </button>

      <button class="shop-panel shop-profile__entry" aria-label="选择示例收货地址" @tap="openAddresses">
        <view class="shop-profile__entry-copy">
          <text class="shop-panel__title">
            收货地址
          </text>
          <text class="shop-address__detail">
            {{ address.title }} · {{ address.detail }}
          </text>
        </view>
        <VIcon name="chevron-right" :size="20" />
      </button>
    </view>
  </view>
</template>

<style>
.shop-profile__identity {
  display: flex;
  gap: 24rpx;
  align-items: center;
  padding: 22rpx 0 38rpx;
}

.shop-profile__avatar {
  display: grid;
  place-items: center;
  width: 112rpx;
  height: 112rpx;
  font-size: 40rpx;
  font-weight: 760;
  color: var(--shop-surface);
  background: var(--shop-accent);
  border-radius: 999rpx;
}

.shop-profile__name {
  margin-bottom: 4rpx;
  font-size: 40rpx;
}

.shop-profile__menu {
  margin-bottom: 22rpx;
}

.shop-profile__entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 128rpx;
  text-align: left;
}

.shop-profile__entry-copy {
  min-width: 0;
}

.shop-profile__entry-copy .shop-panel__title {
  margin-bottom: 2rpx;
}
</style>
