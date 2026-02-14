<script setup lang="ts">
import { ref } from 'wevu'

const items = ref([
  { id: 1, name: '暮光可可泡芙', quantity: 2 },
])

function updateQuantity(item: { id: number, quantity: number }, delta: number) {
  if (item.quantity <= 1 && delta < 0) {
    return
  }
  item.quantity = Math.max(1, item.quantity + delta)
}

function readQty() {
  return items.value[0]?.quantity ?? 0
}

function runE2E() {
  return {
    qty: readQty(),
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="page">
    <view v-for="(item, index) in items" :key="item.id" class="row">
      <text :id="index === 0 ? 'qty-0' : ''" :data-qty="item.quantity" class="qty">
        {{ item.quantity }}
      </text>
      <button :id="index === 0 ? 'minus-0' : ''" class="minus" @tap="updateQuantity(item, -1)">
        -
      </button>
      <button :id="index === 0 ? 'plus-0' : ''" class="plus" @tap="updateQuantity(item, 1)">
        +
      </button>
    </view>
  </view>
</template>

<style>
.page {
  padding: 24rpx;
}

.row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.qty {
  width: 80rpx;
  text-align: center;
}
</style>

<json>
{
  "component": false
}
</json>
