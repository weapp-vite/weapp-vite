<script setup lang="ts">
import { computed } from 'wevu'
import { wpi } from 'wevu/api'
import ShopPhoto from '@/components/shop-photo.vue'
import VButton from '@/components/ui/v-button.vue'
import VIcon from '@/components/ui/v-icon.vue'
import { addresses, formatPrice, getProduct, shippingFor, shop, submitDemoOrder, subtotal } from '@/shop'

definePageJson({
  navigationBarTitleText: '确认订单',
  backgroundColor: '#f5f5eb',
})

const address = computed(() => addresses.find(item => item.id === shop.addressId) ?? addresses[0])
const itemsSubtotal = computed(() => subtotal(shop.checkoutLines))
const shipping = computed(() => shippingFor(itemsSubtotal.value))
const total = computed(() => itemsSubtotal.value + shipping.value)

function chooseAddress() {
  void wpi.navigateTo({ url: '/pages/address/index' })
}

function submit() {
  const order = submitDemoOrder()
  if (!order) {
    void wpi.showToast({ title: '商品库存已变化，请返回重试', icon: 'none' })
    return
  }
  void wpi.redirectTo({ url: `/pages/result/index?id=${encodeURIComponent(order.id)}` })
}
</script>

<template>
  <view class="shop-page shop-page--with-bar">
    <view class="shop-panel">
      <text class="shop-panel__title">
        收货地址
      </text>
      <button class="shop-address" aria-label="选择示例收货地址" @tap="chooseAddress">
        <view>
          <text>{{ address.title }}</text>
          <text class="shop-address__detail">
            {{ address.detail }}
          </text>
        </view>
        <VIcon name="chevron-right" :size="20" />
      </button>
    </view>

    <view class="shop-panel">
      <text class="shop-panel__title">
        商品清单
      </text>
      <view v-for="line in shop.checkoutLines" :key="line.id" class="shop-line shop-checkout-line">
        <ShopPhoto :product-id="line.productId" size="line" />
        <view class="shop-line__body">
          <view class="shop-line__head">
            <text class="shop-line__title">
              {{ getProduct(line.productId)?.title }}
            </text>
            <text class="shop-price">
              {{ formatPrice((getProduct(line.productId)?.price ?? 0) * line.quantity) }}
            </text>
          </view>
          <text class="shop-line__meta">
            {{ line.spec }} × {{ line.quantity }}
          </text>
        </view>
      </view>
    </view>

    <view class="shop-panel">
      <text class="shop-panel__title">
        费用明细
      </text>
      <view class="shop-row">
        <text>商品小计</text>
        <text>{{ formatPrice(itemsSubtotal) }}</text>
      </view>
      <view class="shop-row">
        <text>运费</text>
        <text>{{ shipping === 0 ? '免运费' : formatPrice(shipping) }}</text>
      </view>
    </view>

    <view class="shop-checkout__note">
      订单仅用于本地演示，不会产生扣款。
    </view>

    <view class="shop-bottom-bar">
      <view>
        <text class="shop-muted">
          应付
        </text>
        <text class="shop-price shop-checkout__total">
          {{ formatPrice(total) }}
        </text>
      </view>
      <VButton :disabled="shop.checkoutLines.length === 0" @click="submit">
        提交模拟订单
      </VButton>
    </view>
  </view>
</template>

<style>
.shop-checkout-line + .shop-checkout-line {
  padding-top: 18rpx;
  margin-top: 18rpx;
  border-top: 2rpx solid var(--shop-border);
}

.shop-checkout__note {
  padding: 20rpx 22rpx;
  margin-top: 18rpx;
  font-size: 24rpx;
  color: var(--shop-accent);
  background: var(--shop-accent-soft);
  border-radius: 22rpx;
}

.shop-checkout__total {
  display: block;
  font-size: 38rpx;
}
</style>
