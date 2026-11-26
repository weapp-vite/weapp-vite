<script setup lang="ts">
import { wpi } from 'wevu/api'
import VIcon from '@/components/ui/v-icon.vue'
import { addresses, selectAddress, shop } from '@/shop'

definePageJson({
  navigationBarTitleText: '选择收货地址',
  backgroundColor: '#f5f5eb',
})

function select(id: string) {
  selectAddress(id)
  void wpi.navigateBack()
}
</script>

<template>
  <view class="shop-page">
    <text class="shop-heading">
      选择示例地址
    </text>
    <text class="shop-subheading shop-address-page__intro">
      地址只保存在当前设备，用于演示结算流程。
    </text>

    <button
      v-for="address in addresses"
      :key="address.id"
      class="shop-panel shop-address shop-address-page__item"
      :aria-pressed="shop.addressId === address.id"
      @tap="select(address.id)"
    >
      <view>
        <text>{{ address.title }}</text>
        <text class="shop-address__detail">
          {{ address.detail }}
        </text>
      </view>
      <VIcon :name="shop.addressId === address.id ? 'check' : 'chevron-right'" :size="20" />
    </button>
  </view>
</template>

<style>
.shop-address-page__intro {
  margin-bottom: 26rpx;
}

.shop-address-page__item {
  width: 100%;
}
</style>
