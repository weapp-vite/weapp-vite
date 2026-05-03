<script setup lang="ts">
import { onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'

const totalPaid = ref<number | string>(0)
const orderNo = ref('')
const groupId = ref('')

async function onTapReturn(e: { currentTarget?: { dataset?: { type?: string } } }) {
  const target = e.currentTarget?.dataset?.type
  if (target === 'home') {
    await wpi.switchTab({
      url: '/pages/home/home',
    })
  }
  else if (target === 'orderList') {
    await wpi.navigateTo({
      url: `/pages/order/order-list/index?orderNo=${orderNo.value}`,
    })
  }
  else if (target === 'order') {
    await wpi.navigateTo({
      url: `/pages/order/order-detail/index?orderNo=${orderNo.value}`,
    })
  }
}

onLoad((options: { totalPaid?: string | number, orderNo?: string, groupId?: string } = {}) => {
  totalPaid.value = options.totalPaid ?? 0
  orderNo.value = options.orderNo || ''
  groupId.value = options.groupId || ''
})

definePageJson({
  navigationBarTitleText: '支付结果',
  navigationStyle: 'custom',
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    'price': '/components/price/index',
  },
})
</script>

<template>
  <view class="pay-result flex flex-col items-center w-full [&_.pay-status]:mt-[100rpx] [&_.pay-status]:text-[48rpx] [&_.pay-status]:leading-[72rpx] [&_.pay-status]:[font-weight:bold] [&_.pay-status]:text-[#333333] [&_.pay-status]:flex [&_.pay-status]:items-center [&_.pay-status]:pl-[12rpx] [&_.pay-money]:text-[#666666] [&_.pay-money]:text-[28rpx] [&_.pay-money]:leading-[48rpx] [&_.pay-money]:mt-[28rpx] [&_.pay-money]:flex [&_.pay-money]:items-baseline [&_.pay-money_.pay-money__price]:text-[36rpx] [&_.pay-money_.pay-money__price]:leading-[48rpx] [&_.pay-money_.pay-money__price]:text-[#fa4126] [&_.btn-wrapper]:mt-[48rpx] [&_.btn-wrapper]:p-[12rpx_32rpx] [&_.btn-wrapper]:flex [&_.btn-wrapper]:items-center [&_.btn-wrapper]:justify-between [&_.btn-wrapper]:w-full [&_.btn-wrapper]:box-border [&_.btn-wrapper_.status-btn]:h-[88rpx] [&_.btn-wrapper_.status-btn]:w-[334rpx] [&_.btn-wrapper_.status-btn]:rounded-[44rpx] [&_.btn-wrapper_.status-btn]:[border:2rpx_solid_#fa4126] [&_.btn-wrapper_.status-btn]:text-[#fa4126] [&_.btn-wrapper_.status-btn]:text-[28rpx] [&_.btn-wrapper_.status-btn]:[font-weight:bold] [&_.btn-wrapper_.status-btn]:leading-[88rpx] [&_.btn-wrapper_.status-btn]:text-center">
    <view class="pay-status">
      <t-icon name="check-circle-filled" size="60rpx" color="#47D368" />
      <text>支付成功</text>
    </view>
    <view class="pay-money">
      微信支付：
      <price
        v-if="totalPaid"
        :price="totalPaid"
        wr-class="pay-money__price"
        decimalSmaller
        fill
      />
    </view>
    <view class="btn-wrapper">
      <view class="status-btn" data-type="orderList" @tap="onTapReturn">
        查看订单
      </view>
      <view class="status-btn" data-type="home" @tap="onTapReturn">
        返回首页
      </view>
    </view>
  </view>
</template>
