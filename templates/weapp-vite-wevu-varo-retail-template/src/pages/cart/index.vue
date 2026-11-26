<script setup lang="ts">
import { computed } from 'wevu'
import { wpi } from 'wevu/api'
import ShopPhoto from '@/components/shop-photo.vue'
import VEmpty from '@/components/ui/empty.vue'
import VInputNumber from '@/components/ui/input-number.vue'
import VButton from '@/components/ui/v-button.vue'
import VCheckbox from '@/components/ui/v-checkbox.vue'
import { formatPrice, getProduct, removeCartLine, setCartQuantity, setCartSelection, shop, startCartCheckout, subtotal } from '@/shop'

definePageJson({
  navigationBarTitleText: '购物车',
  backgroundColor: '#f5f5eb',
})

const selectedLines = computed(() => shop.cart.filter(line => line.selected))
const selectedCount = computed(() => selectedLines.value.reduce((count, line) => count + line.quantity, 0))
const selectedSubtotal = computed(() => subtotal(selectedLines.value))

function updateQuantity(id: string, value: number) {
  if (!setCartQuantity(id, value)) {
    void wpi.showToast({ title: '已达到库存上限', icon: 'none' })
  }
}

function checkout() {
  if (!startCartCheckout()) {
    void wpi.showToast({ title: '请选择要结算的商品', icon: 'none' })
    return
  }
  void wpi.navigateTo({ url: '/pages/checkout/index' })
}

function openProduct(productId: string) {
  void wpi.navigateTo({ url: `/pages/detail/index?id=${productId}` })
}

function openShop() {
  void wpi.switchTab({ url: '/pages/home/index' })
}
</script>

<template>
  <view class="shop-page" :class="[{ 'shop-page--with-bar': shop.cart.length > 0 }]">
    <view v-if="shop.cart.length > 0">
      <view v-for="line in shop.cart" :key="line.id" class="shop-panel shop-cart-line">
        <VCheckbox
          :checked="line.selected"
          :aria-label="`选择${getProduct(line.productId)?.title}`"
          @update:checked="setCartSelection(line.id, $event)"
        />
        <ShopPhoto :product-id="line.productId" size="line" />
        <view class="shop-line__body">
          <view class="shop-line__head">
            <button class="shop-cart-line__title" @tap="openProduct(line.productId)">
              {{ getProduct(line.productId)?.title }}
            </button>
            <text class="shop-price">
              {{ formatPrice((getProduct(line.productId)?.price ?? 0) * line.quantity) }}
            </text>
          </view>
          <text class="shop-line__meta">
            {{ line.spec }}
          </text>
          <view class="shop-line__controls">
            <VInputNumber
              :value="line.quantity"
              :min="1"
              :max="getProduct(line.productId)?.stock ?? 1"
              :decrease-aria-label="`减少${getProduct(line.productId)?.title}数量`"
              :increase-aria-label="`增加${getProduct(line.productId)?.title}数量`"
              :input-aria-label="`${getProduct(line.productId)?.title}数量`"
              @update:value="updateQuantity(line.id, $event)"
            />
            <button class="shop-link" :aria-label="`删除${getProduct(line.productId)?.title}`" @tap="removeCartLine(line.id)">
              删除
            </button>
          </view>
        </view>
      </view>
    </view>

    <VEmpty
      v-else
      class="shop-empty"
      icon="info"
      title="购物车还是空的"
      description="先挑一袋今天想喝的咖啡。"
    >
      <VButton @click="openShop">
        去选商品
      </VButton>
    </VEmpty>

    <view v-if="shop.cart.length > 0" class="shop-bottom-bar">
      <view>
        <text class="shop-muted">
          合计
        </text>
        <text class="shop-price shop-cart__total">
          {{ formatPrice(selectedSubtotal) }}
        </text>
      </view>
      <VButton :disabled="selectedCount === 0" @click="checkout">
        去结算（{{ selectedCount }}）
      </VButton>
    </view>
  </view>
</template>

<style>
.shop-cart-line {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 16rpx;
  align-items: start;
}

.shop-cart-line__title {
  min-height: 44rpx;
  padding: 0;
  font-weight: 720;
  text-align: left;
}

.shop-cart__total {
  display: block;
  font-size: 38rpx;
}
</style>
