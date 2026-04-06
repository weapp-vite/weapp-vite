<script setup lang="ts">
import { wpi } from '@wevu/api'
import { computed } from 'wevu'
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
  price?: number | string
  skuId?: string
  specs?: string | string[]
  spuId?: string
  thumb?: string
  title?: string
}

interface OrderData {
  amount?: number | string
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
  totalAmount?: number | string
}

const props = withDefaults(defineProps<{
  order?: OrderData | null
  goodsIndex?: number | null
  isBtnMax?: boolean
}>(), {
  order: () => ({}),
  goodsIndex: null,
  isBtnMax: false,
})

const buttons = computed(() => {
  const order = props.order || {}
  const goodsList = Array.isArray(order.goodsList) ? order.goodsList : []

  if (props.goodsIndex !== null) {
    const goods = goodsList[Number(props.goodsIndex)] || {}
    return {
      left: [] as OrderButton[],
      right: (goods.buttons || []).filter(button => button.type === OrderButtonTypes.APPLY_REFUND),
    }
  }

  const rightButtons = (order.buttons || []).map((button) => {
    if (button.type === OrderButtonTypes.INVITE_GROUPON && order.groupInfoVo) {
      return {
        ...button,
        openType: 'share',
        dataShare: {
          goodsImg: goodsList[0]?.imgUrl,
          goodsName: goodsList[0]?.name,
          groupId: order.groupInfoVo.groupId,
          promotionId: order.groupInfoVo.promotionId,
          remainMember: order.groupInfoVo.remainMember,
          groupPrice: order.groupInfoVo.groupPrice,
          storeId: order.storeId,
        },
      }
    }
    return button
  })

  const deleteBtnIndex = rightButtons.findIndex(button => button.type === OrderButtonTypes.DELETE)
  const leftButtons = deleteBtnIndex > -1 ? rightButtons.splice(deleteBtnIndex, 1) : []

  return {
    left: leftButtons,
    right: rightButtons,
  }
})

function getCurrentGoods() {
  const goodsList = Array.isArray(props.order?.goodsList) ? props.order.goodsList : []
  return goodsList[typeof props.goodsIndex === 'number' ? props.goodsIndex : 0]
}

async function onDelete() {
  showToast({
    message: '你点击了删除订单',
    icon: 'check-circle',
  })
}

async function onCancel() {
  showToast({
    message: '你点击了取消订单',
    icon: 'check-circle',
  })
}

function onConfirm() {
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
      message: '你确认了确认收货',
      icon: 'check-circle',
    })
  }).catch(() => {
    showToast({
      message: '你取消了确认收货',
      icon: 'check-circle',
    })
  })
}

async function onPay() {
  showToast({
    message: '你点击了去支付',
    icon: 'check-circle',
  })
}

async function onBuyAgain() {
  showToast({
    message: '你点击了再次购买',
    icon: 'check-circle',
  })
}

async function onApplyRefund(order: OrderData) {
  const goods = getCurrentGoods()
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
  await wpi.navigateTo({
    url: `/pages/order/apply-service/index?${paramsStr}`,
  })
}

async function onViewRefund() {
  showToast({
    message: '你点击了查看退款',
    icon: '',
  })
}

async function onAddComment(order: OrderData) {
  const firstGoods = order.goodsList?.[0]
  const specs = Array.isArray(firstGoods?.specs) ? firstGoods.specs.join(' ') : (firstGoods?.specs || '')
  await wpi.navigateTo({
    url: `/pages/goods/comments/create/index?specs=${specs}&title=${firstGoods?.title || ''}&orderNo=${order?.orderNo || ''}&imgUrl=${firstGoods?.thumb || ''}`,
  })
}

function onOrderBtnTap(e: { currentTarget?: { dataset?: { type?: number | string } } }) {
  const type = Number(e.currentTarget?.dataset?.type)
  switch (type) {
    case OrderButtonTypes.DELETE:
      void onDelete()
      break
    case OrderButtonTypes.CANCEL:
      void onCancel()
      break
    case OrderButtonTypes.CONFIRM:
      onConfirm()
      break
    case OrderButtonTypes.PAY:
      void onPay()
      break
    case OrderButtonTypes.APPLY_REFUND:
      void onApplyRefund(props.order || {})
      break
    case OrderButtonTypes.VIEW_REFUND:
      void onViewRefund()
      break
    case OrderButtonTypes.COMMENT:
      void onAddComment(props.order || {})
      break
    case OrderButtonTypes.REBUY:
      void onBuyAgain()
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
</template>
