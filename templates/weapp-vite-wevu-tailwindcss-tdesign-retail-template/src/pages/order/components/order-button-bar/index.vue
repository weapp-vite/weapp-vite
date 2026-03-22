<script setup lang="ts">
// @ts-nocheck
import { confirmDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'
import { OrderButtonTypes } from '../../config'

interface SharePayload {
  goodsImg?: string
  goodsName?: string
  groupId?: string | number
  promotionId?: string | number
  remainMember?: number
  groupPrice?: number
  storeId?: string | number
}

interface OrderButton {
  type?: number
  name?: string
  primary?: boolean
  openType?: string
  dataShare?: SharePayload
}

interface OrderGoods {
  buttons?: OrderButton[] | null
  imgUrl?: string
  logisticsNo?: string
  name?: string
  num?: number
  price?: number
  skuId?: string
  specs?: string
  spuId?: string
  thumb?: string
  title?: string
}

interface OrderData {
  amount?: number
  buttonVOs?: OrderButton[] | null
  buttons?: OrderButton[] | null
  createTime?: string
  goodsList?: OrderGoods[] | null
  groupInfoVo?: {
    groupId?: string | number
    groupPrice?: number
    promotionId?: string | number
    remainMember?: number
  } | null
  logisticsNo?: string
  orderNo?: string
  status?: number
  storeId?: string | number
  totalAmount?: number
}

interface ButtonGroups {
  left: OrderButton[]
  right: OrderButton[]
}

interface OrderButtonTapEvent extends WechatMiniprogram.TouchEvent {
  currentTarget: WechatMiniprogram.TouchEvent['currentTarget'] & {
    dataset: WechatMiniprogram.IAnyObject & {
      type?: number | string
    }
  }
}

interface OrderButtonBarData {
  buttons: ButtonGroups
}

type OrderButtonBarProperties = Record<string, WechatMiniprogram.Component.AllProperty> & {
  order: {
    type: ObjectConstructor
  }
  goodsIndex: {
    type: NumberConstructor
    value: null
  }
  isBtnMax: {
    type: BooleanConstructor
    value: false
  }
}

type OrderButtonBarMethods = Record<string, (...args: any[]) => any> & {
  onOrderBtnTap: (this: OrderButtonBarInstance, e: OrderButtonTapEvent) => void
  onDelete: (this: OrderButtonBarInstance) => void
  onCancel: (this: OrderButtonBarInstance) => void
  onConfirm: (this: OrderButtonBarInstance) => void
  onPay: (this: OrderButtonBarInstance) => void
  onBuyAgain: (this: OrderButtonBarInstance) => void
  onApplyRefund: (this: OrderButtonBarInstance, order: OrderData) => void
  onViewRefund: (this: OrderButtonBarInstance) => void
  onAddComment: (this: OrderButtonBarInstance, order: OrderData) => void
}

type OrderButtonBarInstance = WechatMiniprogram.Component.Instance<
  OrderButtonBarData,
  OrderButtonBarProperties,
  OrderButtonBarMethods,
  []
>

defineOptions({
  options: {
    addGlobalClass: true,
  },
  properties: {
    order: {
      type: Object,
      observer(this: OrderButtonBarInstance, order: OrderData) {
        if (!order) { return }

        const goodsList = Array.isArray(order.goodsList) ? order.goodsList : []

        // 判定有传goodsIndex ，则认为是商品button bar, 仅显示申请售后按钮
        if (this.properties?.goodsIndex !== null) {
          const goods = goodsList[Number(this.properties.goodsIndex)] || {}
          this.setData({
            buttons: {
              left: [],
              right: (goods.buttons || []).filter((b: OrderButton) => b.type === OrderButtonTypes.APPLY_REFUND),
            },
          })
          return
        }
        // 订单的button bar 不显示申请售后按钮
        const buttonsRight = (order.buttons || []
        // .filter((b) => b.type !== OrderButtonTypes.APPLY_REFUND)
        ).map((button: OrderButton) => {
          // 邀请好友拼团按钮
          if (button.type === OrderButtonTypes.INVITE_GROUPON && order.groupInfoVo) {
            const {
              groupInfoVo: {
                groupId,
                promotionId,
                remainMember,
                groupPrice,
              },
            } = order
            const goodsImg = goodsList[0] && goodsList[0].imgUrl
            const goodsName = goodsList[0] && goodsList[0].name
            return {
              ...button,
              openType: 'share',
              dataShare: {
                goodsImg,
                goodsName,
                groupId,
                promotionId,
                remainMember,
                groupPrice,
                storeId: order.storeId,
              },
            }
          }
          return button
        })
        // 删除订单按钮单独挪到左侧
        const deleteBtnIndex = buttonsRight.findIndex(b => b.type === OrderButtonTypes.DELETE)
        let buttonsLeft: OrderButton[] = []
        if (deleteBtnIndex > -1) {
          buttonsLeft = buttonsRight.splice(deleteBtnIndex, 1)
        }
        this.setData({
          buttons: {
            left: buttonsLeft,
            right: buttonsRight,
          },
        })
      },
    },
    goodsIndex: {
      type: Number,
      value: null,
    },
    isBtnMax: {
      type: Boolean,
      value: false,
    },
  },
  data() {
    return {
      buttons: {
        left: [],
        right: [],
      } as ButtonGroups,
    }
  },
  methods: {
    // 点击【订单操作】按钮，根据按钮类型分发
    onOrderBtnTap(this: OrderButtonBarInstance, e: OrderButtonTapEvent) {
      const {
        type,
      } = e.currentTarget.dataset
      switch (Number(type)) {
        case OrderButtonTypes.DELETE:
          this.onDelete()
          break
        case OrderButtonTypes.CANCEL:
          this.onCancel()
          break
        case OrderButtonTypes.CONFIRM:
          this.onConfirm()
          break
        case OrderButtonTypes.PAY:
          this.onPay()
          break
        case OrderButtonTypes.APPLY_REFUND:
          this.onApplyRefund(this.data.order)
          break
        case OrderButtonTypes.VIEW_REFUND:
          this.onViewRefund()
          break
        case OrderButtonTypes.COMMENT:
          this.onAddComment(this.data.order)
          break
        case OrderButtonTypes.INVITE_GROUPON:
          // 分享邀请好友拼团
          break
        case OrderButtonTypes.REBUY:
          this.onBuyAgain()
          break
      }
    },
    onDelete(this: OrderButtonBarInstance) {
      showToast({
        context: this,
        message: '你点击了删除订单',
        icon: 'check-circle',
      })
    },
    onCancel(this: OrderButtonBarInstance) {
      showToast({
        context: this,
        message: '你点击了取消订单',
        icon: 'check-circle',
      })
    },
    onConfirm(this: OrderButtonBarInstance) {
      const task = confirmDialog({
        title: '确认是否已经收到货？',
        content: '',
        confirmBtn: '确认收货',
        cancelBtn: '取消',
      })
      if (!task) {
        return
      }
      task.then(() => {
        showToast({
          context: this,
          message: '你确认了确认收货',
          icon: 'check-circle',
        })
      }).catch(() => {
        showToast({
          context: this,
          message: '你取消了确认收货',
          icon: 'check-circle',
        })
      })
    },
    onPay(this: OrderButtonBarInstance) {
      showToast({
        context: this,
        message: '你点击了去支付',
        icon: 'check-circle',
      })
    },
    onBuyAgain(this: OrderButtonBarInstance) {
      showToast({
        context: this,
        message: '你点击了再次购买',
        icon: 'check-circle',
      })
    },
    onApplyRefund(this: OrderButtonBarInstance, order: OrderData) {
      const goodsList = Array.isArray(order?.goodsList) ? order.goodsList : []
      const goodsIndex = typeof this.properties.goodsIndex === 'number' ? this.properties.goodsIndex : 0
      const goods = goodsList[goodsIndex]
      const params: Record<string, string | number | boolean | undefined> = {
        orderNo: order.orderNo,
        skuId: goods?.skuId ?? '19384938948343',
        spuId: goods?.spuId ?? '28373847384343',
        orderStatus: order.status,
        logisticsNo: order.logisticsNo,
        price: goods?.price ?? 89,
        num: goods?.num ?? 89,
        createTime: order.createTime,
        orderAmt: order.totalAmount,
        payAmt: order.amount,
        canApplyReturn: true,
      }
      const paramsStr = Object.entries(params).map(([key, value]) => `${key}=${value ?? ''}`).join('&')
      wx.navigateTo({
        url: `/pages/order/apply-service/index?${paramsStr}`,
      })
    },
    onViewRefund(this: OrderButtonBarInstance) {
      showToast({
        context: this,
        message: '你点击了查看退款',
        icon: '',
      })
    },
    /** 添加订单评论 */
    onAddComment(this: OrderButtonBarInstance, order: OrderData) {
      const imgUrl = order?.goodsList?.[0]?.thumb || ''
      const title = order?.goodsList?.[0]?.title || ''
      const specs = order?.goodsList?.[0]?.specs || ''
      wx.navigateTo({
        url: `/pages/goods/comments/create/index?specs=${specs}&title=${title}&orderNo=${order?.orderNo}&imgUrl=${imgUrl}`,
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
  <view class="btn-bar [display:flex] [justify-content:space-between] [align-items:center] [line-height:1] [&_.order-btn]:[line-height:1] [&_.right]:[display:flex] [&_.right]:[align-items:center] [&_.t-button]:[width:160rpx] [&_.t-button]:[font-weight:400] [&_.t-button]:[margin-left:24rpx] [&_.t-button--max]:[width:176rpx] [&_.t-button--max]:[margin-left:24rpx] [&_.left_.delete-btn]:[font-size:22rpx]">
    <view class="left">
      <t-button
        v-for="(leftBtn, index) in buttons.left"
        :key="leftBtn.type || index"
        size="extra-small"
        shape="round"
        :t-class="`${isBtnMax ? 't-button--max' : 't-button'}  order-btn delete-btn`"
        hover-class="order-btn--active"
        :data-type="leftBtn.type"
        @tap.stop="onOrderBtnTap"
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
        :t-class="`${isBtnMax ? 't-button--max' : 't-button'} order-btn ${rightBtn.primary ? 'primary' : 'normal'}`"
        hover-class="order-btn--active"
        :data-type="rightBtn.type"
        :open-type="rightBtn.openType || ''"
        :data-share="rightBtn.dataShare"
        @tap.stop="onOrderBtnTap"
      >
        {{ rightBtn.name }}
      </t-button>
    </view>
  </view>
  <t-toast id="t-toast" />
  <t-dialog id="t-dialog" />
</template>
