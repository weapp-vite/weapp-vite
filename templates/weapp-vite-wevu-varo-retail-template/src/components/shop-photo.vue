<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(defineProps<{
  productId: string
  size?: 'card' | 'detail' | 'line'
}>(), {
  size: 'card',
})

const classes = computed(() => [
  'shop-photo',
  `shop-photo--${props.productId}`,
  `shop-photo--${props.size}`,
])
</script>

<template>
  <view :class="classes" aria-hidden="true">
    <image class="shop-photo__sheet" src="/coffee-products.jpg" mode="scaleToFill" />
  </view>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
