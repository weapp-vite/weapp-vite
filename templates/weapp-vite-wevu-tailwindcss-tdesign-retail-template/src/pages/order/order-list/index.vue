<script setup lang="ts">
import type { OrdersResult } from '../../../model/order/orderList'
import { wpi } from '@wevu/api'
import { onLoad, onPageScroll, onReachBottom, onShow, ref, useNativeInstance } from 'wevu'
import { fetchOrders, fetchOrdersCount } from '../../../services/order/orderList'
import { cosThumb } from '../../../utils/util'
import { OrderStatus } from '../config'

interface TabItem {
  key: number
  text: string
  info?: number | string
}

type SourceOrderItem = OrdersResult['data']['orders'][number]

interface NormalizedGoodsItem {
  id: string
  thumb: string
  title: string
  skuId: string
  spuId: string
  specs: string[]
  price: string | number
  num: number
  titlePrefixTags: Array<{ text: string }>
}

interface NormalizedOrderItem {
  id: string
  orderNo: string
  parentOrderNo: string
  storeId: string
  storeName: string
  status: number
  statusDesc: string
  amount: string
  totalAmount: string
  logisticsNo: string
  createTime: string
  goodsList: NormalizedGoodsItem[]
  buttons: NonNullable<SourceOrderItem['buttonVOs']>
  groupInfoVo?: any
  freightFee: string
}

interface QueryOptions {
  status?: string
}

const nativeInstance = useNativeInstance()
const page = {
  size: 5,
  num: 1,
}
const tabs = ref<TabItem[]>([
  { key: -1, text: '全部' },
  { key: OrderStatus.PENDING_PAYMENT, text: '待付款', info: '' },
  { key: OrderStatus.PENDING_DELIVERY, text: '待发货', info: '' },
  { key: OrderStatus.PENDING_RECEIPT, text: '待收货', info: '' },
  { key: OrderStatus.COMPLETE, text: '已完成', info: '' },
])
const curTab = ref(-1)
const orderList = ref<NormalizedOrderItem[]>([])
const listLoading = ref(0)
const pullDownRefreshing = ref(false)
const emptyImg = ref('https://tdesign.gtimg.com/miniprogram/template/retail/order/empty-order-list.png')
const backRefresh = ref(false)
const status = ref(-1)
const pullDownRefresh = ref<any>(null)

function normalizeStatus(rawStatus?: string) {
  const parsedStatus = Number.parseInt(rawStatus || '-1', 10)
  return tabs.value.map(item => item.key).includes(parsedStatus) ? parsedStatus : -1
}

function normalizeOrder(order: SourceOrderItem): NormalizedOrderItem {
  return {
    id: order.orderId,
    orderNo: order.orderNo,
    parentOrderNo: order.parentOrderNo,
    storeId: order.storeId,
    storeName: order.storeName,
    status: order.orderStatus,
    statusDesc: order.orderStatusName,
    amount: order.paymentAmount,
    totalAmount: order.totalAmount,
    logisticsNo: order.logisticsVO.logisticsNo,
    createTime: order.createTime,
    goodsList: (order.orderItemVOs || []).map(goods => ({
      id: goods.id,
      thumb: cosThumb(goods.goodsPictureUrl, 70),
      title: goods.goodsName,
      skuId: goods.skuId,
      spuId: goods.spuId,
      specs: (goods.specifications || []).map(spec => spec.specValue),
      price: goods.tagPrice || goods.actualPrice,
      num: goods.buyQuantity,
      titlePrefixTags: goods.tagText ? [{ text: goods.tagText }] : [],
    })),
    buttons: order.buttonVOs || [],
    groupInfoVo: (order as any).groupInfoVo,
    freightFee: order.freightFee,
  }
}

async function getOrderList(statusCode = -1, reset = false) {
  const params: {
    parameter: {
      pageSize: number
      pageNum: number
      orderStatus?: number
    }
  } = {
    parameter: {
      pageSize: page.size,
      pageNum: page.num,
    },
  }
  if (statusCode !== -1) {
    params.parameter.orderStatus = statusCode
  }
  listLoading.value = 1

  try {
    const res = await fetchOrders(params)
    page.num += 1
    const nextOrderList = (res.data.orders || []).map(normalizeOrder)
    orderList.value = reset ? nextOrderList : orderList.value.concat(nextOrderList)
    listLoading.value = nextOrderList.length > 0 ? 0 : 2
  }
  catch (error) {
    listLoading.value = 3
    throw error
  }
}

async function getOrdersCount() {
  const res = await fetchOrdersCount()
  const tabsCount = res.data || []
  tabs.value = tabs.value.map((tab) => {
    const tabCount = tabsCount.find(item => item.tabType === tab.key)
    return tabCount
      ? {
          ...tab,
          info: tabCount.orderNum,
        }
      : tab
  })
}

async function refreshList(nextStatus = -1) {
  page.num = 1
  curTab.value = nextStatus
  orderList.value = []
  await Promise.all([
    getOrderList(nextStatus, true),
    getOrdersCount(),
  ])
}

function init(nextStatus?: number) {
  const resolvedStatus = typeof nextStatus === 'number' ? nextStatus : curTab.value
  status.value = resolvedStatus
  void refreshList(resolvedStatus)
}

async function onPullDownRefresh_(e: { detail?: { callback?: () => void } }) {
  pullDownRefreshing.value = true
  try {
    await refreshList(curTab.value)
  }
  finally {
    pullDownRefreshing.value = false
    e.detail?.callback?.()
  }
}

function onReTryLoad() {
  void getOrderList(curTab.value)
}

function onTabChange(e: { detail?: { value?: number } }) {
  const value = e.detail?.value ?? -1
  status.value = value
  void refreshList(value)
}

function onRefresh() {
  void refreshList(curTab.value)
}

async function onOrderCardTap(e: { currentTarget?: { dataset?: { order?: NormalizedOrderItem } } }) {
  const order = e.currentTarget?.dataset?.order
  if (!order) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/order/order-detail/index?orderNo=${order.orderNo}`,
  })
}

onLoad((query: QueryOptions = {}) => {
  init(normalizeStatus(query.status))
  pullDownRefresh.value = nativeInstance.selectComponent?.('#pull-down-refresh') ?? null
})

onShow(() => {
  if (!backRefresh.value) {
    return
  }
  onRefresh()
  backRefresh.value = false
})

onReachBottom(() => {
  if (listLoading.value === 0) {
    void getOrderList(curTab.value)
  }
})

onPageScroll((e) => {
  pullDownRefresh.value?.onPageScroll?.(e)
})

definePageJson({
  navigationBarTitleText: '我的订单',
  usingComponents: {
    't-tabs': 'tdesign-miniprogram/tabs/tabs',
    't-tab-panel': 'tdesign-miniprogram/tab-panel/tab-panel',
    't-empty': 'tdesign-miniprogram/empty/empty',
    't-pull-down-refresh': 'tdesign-miniprogram/pull-down-refresh/pull-down-refresh',
    'load-more': '/components/load-more/index',
    'order-button-bar': '../components/order-button-bar/index',
    'price': '/components/price/index',
    'order-card': '../components/order-card/index',
    'specs-goods-card': '../components/specs-goods-card/index',
  },
})
</script>

<template>
  <view class="page-container [&_.tab-bar__placeholder]:[height:88rpx] [&_.tab-bar__placeholder]:[line-height:88rpx] [&_.tab-bar__placeholder]:[background:#fff] [&_.tab-bar__inner]:[height:88rpx] [&_.tab-bar__inner]:[line-height:88rpx] [&_.tab-bar__inner]:[background:#fff] [&_.tab-bar__inner]:[font-size:26rpx] [&_.tab-bar__inner]:[color:#333333] [&_.tab-bar__inner]:[position:fixed] [&_.tab-bar__inner]:[width:100vw] [&_.tab-bar__inner]:[top:0] [&_.tab-bar__inner]:[left:0] [&_.tab-bar__inner_.order-nav_.order-nav-item_.bottom-line]:[bottom:12rpx] [&_.tab-bar__active]:[font-size:28rpx] [&_.specs-popup_.bottom-btn]:[color:#fa4126] [&_.specs-popup_.bottom-btn]:[color:var(--color-primary,_#fa4126)] [&_.order-number]:[color:#666666] [&_.order-number]:[font-size:28rpx]">
    <view class="tab-bar [&_.tab-bar__active]:[color:#333333] [&_.t-tabs-track]:[background:#333333]">
      <view class="tab-bar__placeholder" />
      <t-tabs
        t-class="tab-bar__inner [&_.t-tabs-is-active]:[color:#fa4126] [&_.t-tabs-track]:[background:#fa4126]"
        t-class-active="tab-bar__active"
        t-class-track="t-tabs-track"
        :value="status"
        style="position: fixed; top: 0; left: 0; z-index: 100"
        @change="onTabChange"
      >
        <t-tab-panel
          v-for="(item, index) in tabs"
          :key="index"
          :label="item.text"
          :value="item.key"
        />
      </t-tabs>
    </view>
    <t-pull-down-refresh
      id="pull-down-refresh"
      :normal-bar-height="200"
      :max-bar-height="272"
      :refreshTimeout="3000"
      background="#f5f5f5"
      use-loading-slot
      loading-size="60rpx"
      t-class-indicator="t-class-indicator"
      @refresh="onPullDownRefresh_"
    >
      <order-card
        v-for="(order, oIndex) in orderList"
        :key="order.id || oIndex"
        :order="order"
        :defaultShowNum="3"
        :data-order="order"
        useLogoSlot
        @cardtap="onOrderCardTap"
      >
        <template #top-left>
          <view class="order-number">
            <text decode>
              订单号&nbsp;
            </text>
            {{ order.orderNo }}
          </view>
        </template>
        <specs-goods-card
          v-for="(goods, gIndex) in order.goodsList"
          :key="goods.id || gIndex"
          :data="goods"
          :no-top-line="gIndex === 0"
        />
        <template #more>
          <view>
            <view class="price-total [font-size:24rpx] [line-height:32rpx] [color:#999999] [padding-top:10rpx] [width:100%] [display:flex] [align-items:baseline] [justify-content:flex-end] [&_.bold-price]:[color:#333333] [&_.bold-price]:[font-size:28rpx] [&_.bold-price]:[line-height:40rpx] [&_.real-pay]:[font-size:36rpx] [&_.real-pay]:[line-height:48rpx] [&_.real-pay]:[color:#fa4126] [&_.real-pay]:[font-weight:bold]">
              <text>总价</text>
              <price fill :price="`${order.totalAmount}`" />
              <text>，运费</text>
              <price fill :price="`${order.freightFee}`" />
              <text decode>
&nbsp;
              </text>
              <text class="bold-price" :decode="true">
                实付&nbsp;
              </text>
              <price fill class="real-pay" :price="`${order.amount}`" decimalSmaller />
            </view>
            <!-- 订单按钮栏 -->
            <order-button-bar :order="order" :data-order="order" @refresh="onRefresh" />
          </view>
        </template>
      </order-card>
      <!-- 列表加载中/已全部加载 -->
      <load-more
        v-if="!pullDownRefreshing"
        :list-is-empty="!orderList.length"
        :status="listLoading"
        @retry="onReTryLoad"
      >
        <!-- 空态 -->
        <template #empty>
          <view class="empty-wrapper [height:calc(100vh_-_88rpx)]">
            <t-empty t-class="t-empty-text [font-size:28rpx] [color:#999]" :src="emptyImg">
              暂无相关订单
            </t-empty>
          </view>
        </template>
      </load-more>
    </t-pull-down-refresh>
  </view>
</template>
