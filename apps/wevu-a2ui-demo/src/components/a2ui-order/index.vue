<script setup lang="ts">
const props = defineProps<{ number: string, product: string, amount: string }>()
</script>

<template>
  <view class="order">
    <text id="order-number" class="eyebrow">订单 {{ props.number }}</text>
    <text id="order-product" class="product">{{ props.product }}</text>
    <text class="amount">实付 ¥{{ props.amount }}</text>
  </view>
</template>

<style scoped>
.order {
  padding: 32rpx;
  background: #e7ecdf;
  border-radius: 24rpx;
}

.eyebrow {
  display: block;
  font-size: 22rpx;
  color: #59664f;
}

.product {
  display: block;
  margin-top: 24rpx;
  font-size: 34rpx;
  font-weight: 600;
}

.amount {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
}
</style>
