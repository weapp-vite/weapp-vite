<script setup lang="ts">
// @ts-nocheck
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
  buttonVOs?: ServiceButton[] | null
  buttons?: ServiceButton[] | null
  id?: string
  logistics?: Record<string, unknown>
  logisticsCompanyCode?: string
  logisticsCompanyName?: string
  logisticsNo?: string
  logisticsVO?: Record<string, unknown>
  remark?: string
}

interface ButtonGroups {
  left: ServiceButton[]
  right: ServiceButton[]
}

interface ServiceButtonTapEvent extends WechatMiniprogram.TouchEvent {
  currentTarget: WechatMiniprogram.TouchEvent['currentTarget'] & {
    dataset: WechatMiniprogram.IAnyObject & {
      type?: number | string
    }
  }
}

interface AfterServiceButtonBarData {
  service: ServiceData
  buttons: ButtonGroups
}

type AfterServiceButtonBarProperties = Record<string, WechatMiniprogram.Component.AllProperty> & {
  service: {
    type: ObjectConstructor
  }
}

type AfterServiceButtonBarMethods = Record<string, (...args: any[]) => any> & {
  onServiceBtnTap: (this: AfterServiceButtonBarInstance, e: ServiceButtonTapEvent) => void
  onFillTrackingNo: (this: AfterServiceButtonBarInstance, service: ServiceData) => void
  viewDelivery: (this: AfterServiceButtonBarInstance, service: ServiceData) => void
  onChangeTrackingNo: (this: AfterServiceButtonBarInstance, service: ServiceData) => void
  onConfirm: (this: AfterServiceButtonBarInstance) => void
}

type AfterServiceButtonBarInstance = WechatMiniprogram.Component.Instance<
  AfterServiceButtonBarData,
  AfterServiceButtonBarProperties,
  AfterServiceButtonBarMethods,
  []
>

defineOptions<AfterServiceButtonBarData, never, AfterServiceButtonBarMethods, AfterServiceButtonBarProperties>({
  properties: {
    service: {
      type: Object,
      observer(this: AfterServiceButtonBarInstance, service: ServiceData) {
        const buttonsRight = service.buttons || service.buttonVOs || []
        this.setData({
          buttons: {
            left: [],
            right: buttonsRight,
          },
        })
      },
    },
  },
  data() {
    return {
      service: {} as ServiceData,
      buttons: {
        left: [],
        right: [],
      } as ButtonGroups,
    }
  },
  methods: {
    // 点击【订单操作】按钮，根据按钮类型分发
    onServiceBtnTap(this: AfterServiceButtonBarInstance, e: ServiceButtonTapEvent) {
      const {
        type,
      } = e.currentTarget.dataset
      switch (Number(type)) {
        case ServiceButtonTypes.REVOKE:
          this.onConfirm()
          break
        case ServiceButtonTypes.FILL_TRACKING_NO:
          this.onFillTrackingNo(this.data.service)
          break
        case ServiceButtonTypes.CHANGE_TRACKING_NO:
          this.onChangeTrackingNo(this.data.service)
          break
        case ServiceButtonTypes.VIEW_DELIVERY:
          this.viewDelivery(this.data.service)
          break
      }
    },
    onFillTrackingNo(this: AfterServiceButtonBarInstance, service: ServiceData) {
      wx.navigateTo({
        url: `/pages/order/fill-tracking-no/index?rightsNo=${service.id}`,
      })
    },
    viewDelivery(this: AfterServiceButtonBarInstance, service: ServiceData) {
      wx.navigateTo({
        url: `/pages/order/delivery-detail/index?data=${JSON.stringify(service.logistics || service.logisticsVO)}&source=2`,
      })
    },
    onChangeTrackingNo(this: AfterServiceButtonBarInstance, service: ServiceData) {
      wx.navigateTo({
        url: `/pages/order/fill-tracking-no/index?rightsNo=${service.id}&logisticsNo=${service.logisticsNo}&logisticsCompanyName=${service.logisticsCompanyName}&logisticsCompanyCode=${service.logisticsCompanyCode}&remark=${service.remark || ''}`,
      })
    },
    onConfirm(this: AfterServiceButtonBarInstance) {
      const task = confirmDialog({
        title: '是否撤销退货申请？',
        content: '',
        confirmBtn: '撤销申请',
        cancelBtn: '不撤销',
      })
      if (!task) {
        return
      }
      task.then(() => {
        const params = {
          rightsNo: this.data.service.id,
        }
        return cancelRights(params).then(() => {
          showToast({
            context: this,
            message: '你确认撤销申请',
          })
        })
      })
    },
  },
})

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
