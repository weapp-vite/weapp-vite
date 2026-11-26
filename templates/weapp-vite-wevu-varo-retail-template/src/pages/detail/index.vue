<script setup lang="ts">
import { computed, onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'
import ShopPhoto from '@/components/shop-photo.vue'
import VInputNumber from '@/components/ui/input-number.vue'
import VButton from '@/components/ui/v-button.vue'
import { addProduct, formatPrice, getProduct, shop, startDirectCheckout } from '@/shop'

definePageJson({
  navigationBarTitleText: '商品详情',
  backgroundColor: '#f5f5eb',
})

const productId = ref('dawn')
const specIndex = ref(0)
const quantity = ref(1)
const product = computed(() => getProduct(productId.value) ?? getProduct('dawn')!)
const cartQuantity = computed(() => shop.cart.reduce((count, line) => count + line.quantity, 0))

onLoad((query: { id?: string } = {}) => {
  if (query.id && getProduct(query.id)) {
    productId.value = query.id
  }
})

function addToCart() {
  if (!addProduct(product.value.id, product.value.specs[specIndex.value], quantity.value)) {
    void wpi.showToast({ title: '库存不足', icon: 'none' })
    return
  }
  void wpi.showToast({ title: '已加入购物车', icon: 'success' })
}

function buyNow() {
  if (!startDirectCheckout(product.value.id, product.value.specs[specIndex.value], quantity.value)) {
    void wpi.showToast({ title: '库存不足', icon: 'none' })
    return
  }
  void wpi.navigateTo({ url: '/pages/checkout/index' })
}

function openCart() {
  void wpi.switchTab({ url: '/pages/cart/index' })
}
</script>

<template>
  <view class="shop-page shop-page--with-bar shop-detail">
    <ShopPhoto :product-id="product.id" size="detail" />
    <view class="shop-detail__title">
      <text class="shop-heading">
        {{ product.title }}
      </text>
      <text class="shop-price shop-detail__price">
        {{ formatPrice(product.price) }}
      </text>
    </view>
    <text class="shop-subheading shop-detail__description">
      {{ product.description }}
    </text>

    <view class="shop-panel">
      <text class="shop-panel__title">
        选择规格
      </text>
      <view class="shop-detail__specs">
        <VButton
          v-for="(item, index) in product.specs"
          :key="item"
          :aria-pressed="specIndex === index"
          size="sm"
          :variant="specIndex === index ? 'solid' : 'outline'"
          @click="specIndex = index"
        >
          {{ item }}
        </VButton>
      </view>
      <view class="shop-row shop-detail__quantity">
        <text>购买数量</text>
        <VInputNumber
          v-model:value="quantity"
          :min="1"
          :max="product.stock"
          decrease-aria-label="减少购买数量"
          increase-aria-label="增加购买数量"
          input-aria-label="购买数量"
        />
      </view>
    </view>

    <view class="shop-bottom-bar">
      <VButton size="sm" variant="text" aria-label="查看购物车" @click="openCart">
        购物车 {{ cartQuantity || '' }}
      </VButton>
      <view class="shop-bottom-bar__actions">
        <VButton size="sm" variant="text" @click="addToCart">
          加入购物车
        </VButton>
        <VButton @click="buyNow">
          立即购买
        </VButton>
      </view>
    </view>
  </view>
</template>

<style>
.shop-detail__title {
  display: flex;
  gap: 20rpx;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 24rpx;
}

.shop-detail__price {
  flex: 0 0 auto;
  font-size: 38rpx;
}

.shop-detail__description {
  margin: 10rpx 0 28rpx;
}

.shop-detail__specs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.shop-detail__quantity {
  margin-top: 22rpx;
}
</style>
