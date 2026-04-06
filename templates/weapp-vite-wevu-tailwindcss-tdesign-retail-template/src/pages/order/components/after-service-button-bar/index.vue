<script setup lang="ts">
import { wpi } from '@wevu/api'
import { computed } from 'wevu'
import { confirmDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'
import { cancelRights } from '../../after-service-detail/api'
import { ServiceButtonTypes } from '../../config'

interface ServiceButton {
  type?: number
  name?: string
  primary?: boolean
  openType?: string
  dataShare?: Record<string, unknown>
}

interface ServiceData {
  buttons?: ServiceButton[] | null
  buttonVOs?: ServiceButton[] | null
  id?: string
  logistics?: Record<string, unknown>
  logisticsVO?: Record<string, unknown>
  logisticsCompanyCode?: string
  logisticsCompanyName?: string
  logisticsNo?: string
  remark?: string
}

const props = withDefaults(defineProps<{
  service?: ServiceData | null
}>(), {
  service: () => ({}),
})

const buttons = computed(() => {
  return {
    left: [] as ServiceButton[],
    right: props.service?.buttons || props.service?.buttonVOs || [],
  }
})

async function onFillTrackingNo(service: ServiceData) {
  await wpi.navigateTo({
    url: `/pages/order/fill-tracking-no/index?rightsNo=${service.id || ''}`,
  })
}

async function viewDelivery(service: ServiceData) {
  await wpi.navigateTo({
    url: `/pages/order/delivery-detail/index?data=${JSON.stringify(service.logistics || service.logisticsVO || {})}&source=2`,
  })
}

async function onChangeTrackingNo(service: ServiceData) {
  await wpi.navigateTo({
    url: `/pages/order/fill-tracking-no/index?rightsNo=${service.id || ''}&logisticsNo=${service.logisticsNo || ''}&logisticsCompanyName=${service.logisticsCompanyName || ''}&logisticsCompanyCode=${service.logisticsCompanyCode || ''}&remark=${service.remark || ''}`,
  })
}

function onConfirm() {
  const task = confirmDialog({
    title: '是否撤销退货申请？',
    content: '',
    confirmBtn: '撤销申请',
    cancelBtn: '不撤销',
  })
  if (!task) {
    return
  }
  task.then(async () => {
    await cancelRights({
      rightsNo: props.service?.id,
    })
    showToast({
      message: '你确认撤销申请',
    })
  })
}

function onServiceBtnTap(e: { currentTarget?: { dataset?: { type?: number | string } } }) {
  const type = Number(e.currentTarget?.dataset?.type)
  switch (type) {
    case ServiceButtonTypes.REVOKE:
      onConfirm()
      break
    case ServiceButtonTypes.FILL_TRACKING_NO:
      void onFillTrackingNo(props.service || {})
      break
    case ServiceButtonTypes.CHANGE_TRACKING_NO:
      void onChangeTrackingNo(props.service || {})
      break
    case ServiceButtonTypes.VIEW_DELIVERY:
      void viewDelivery(props.service || {})
      break
  }
}

defineComponentJson({
  component: true,
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
  },
})
</script>

<template>
  <view class="btn-bar [display:flex] [justify-content:space-between] [align-items:center] [line-height:1] [&_.order-btn]:[background-color:inherit] [&_.order-btn]:[font-size:26rpx] [&_.order-btn]:[padding:16rpx_28rpx] [&_.order-btn]:[line-height:1] [&_.order-btn]:[border-radius:unset] [&_.order-btn]:[min-width:160rpx] [&_.order-btn]:[border-radius:32rpx] [&_.order-btn]:[height:60rpx] [&_.order-btn]:[margin-right:10rpx] [&_.left_.delete-btn]:[font-size:22rpx]">
    <view class="left">
      <t-button
        v-for="(leftBtn, index) in buttons.left"
        :key="leftBtn.type || index"
        size="extra-small"
        shape="round"
        t-class="order-btn delete-btn"
        :data-type="leftBtn.type"
        @tap.stop="onServiceBtnTap"
      >
        {{ leftBtn.name }}
      </t-button>
    </view>
    <view class="right">
      <t-button
        v-for="(rightBtn, index) in buttons.right"
        :key="rightBtn.type || index"
        size="extra-small"
        :variant="rightBtn.primary ? 'base' : 'outline'"
        shape="round"
        :t-class="`order-btn ${rightBtn.primary ? 'primary' : 'normal'}`"
        :data-type="rightBtn.type"
        :open-type="rightBtn.openType || ''"
        :data-share="rightBtn.dataShare"
        @tap.stop="onServiceBtnTap"
      >
        {{ rightBtn.name }}
      </t-button>
    </view>
  </view>
</template>
