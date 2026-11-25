<script setup lang="ts">
import type { Product } from '@/shop'
import VButton from '@/components/ui/v-button.vue'
import { formatPrice } from '@/shop'
import ShopPhoto from './shop-photo.vue'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  add: [productId: string]
  open: [productId: string]
}>()
</script>

<template>
  <view class="shop-product-card">
    <view class="shop-product-card__main" role="button" :aria-label="`查看${props.product.title}`" @tap="emit('open', props.product.id)">
      <ShopPhoto :product-id="props.product.id" />
      <view class="shop-product-card__body">
        <text class="shop-product-card__title">
          {{ props.product.title }}
        </text>
        <text class="shop-product-card__hint">
          {{ props.product.hint }}
        </text>
        <text class="shop-price shop-product-card__price">
          {{ formatPrice(props.product.price) }}
        </text>
      </view>
    </view>
    <VButton
      class-name="shop-product-card__add"
      shape="square"
      size="sm"
      icon="plus"
      :aria-label="`将${props.product.title}加入购物车`"
      @click="emit('add', props.product.id)"
    />
  </view>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
