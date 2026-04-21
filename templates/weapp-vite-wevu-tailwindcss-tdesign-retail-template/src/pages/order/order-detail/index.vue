<script setup lang="ts">
import type { BusinessTimeResult, OrderDetailData } from '../../../model/order/orderDetail'
import type { SelectableAddress } from '../../../services/address/list'
import { onLoad, onPageScroll, onShow, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { getAddressPromise } from '../../../services/address/list'
import { fetchBusinessTime, fetchOrderDetail } from '../../../services/order/orderDetail'
import { formatTime } from '../../../utils/util'
import { LogisticsIconMap, OrderStatus } from '../config'

interface QueryOptions {
  orderNo?: string
}

type OrderDetailView = OrderDetailData & {
  holdStatus?: number
  groupInfoVo?: {
    groupId?: string | number
    promotionId?: string | number
    remainMember?: number
    groupPrice?: number
    residueTime?: number
  } | null
  trajectoryVos?: Array<{
    title?: string
    code?: string
    nodes?: Array<{
      status?: string
      timestamp?: string | number
    }>
  }>
}

interface LogisticsNodeItem {
  title: string
  desc: string
  date: string
  icon: string
}

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
  buttons: NonNullable<OrderDetailData['orderItemVOs'][number]['buttonVOs']>
}

interface NormalizedOrderData {
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
  goodsList: NormalizedGoodsItem[]
  buttons: NonNullable<OrderDetailData['buttonVOs']>
  createTime: string
  receiverAddress: string
  groupInfoVo: OrderDetailView['groupInfoVo']
}

interface StoreDetailState {
  storeTel: string
  storeBusiness: string
}

interface PageInstanceWithBackRefresh extends WechatMiniprogram.Page.Instance<Record<string, any>, Record<string, any>> {
  data: {
    backRefresh?: boolean
  } & Record<string, any>
}

const nativeInstance = useNativeInstance()
const orderNo = ref('')
const pageLoading = ref(true)
const order = ref<OrderDetailView>(({
  saasId: '',
  storeId: '',
  storeName: '',
  uid: '',
  parentOrderNo: '',
  orderId: '',
  orderNo: '',
  orderType: 0,
  orderSubType: 0,
  orderStatus: 0,
  orderSubStatus: null,
  totalAmount: '0',
  goodsAmount: '0',
  goodsAmountApp: '0',
  paymentAmount: '0',
  freightFee: '0',
  packageFee: '0',
  discountAmount: '0',
  channelType: 0,
  channelSource: '',
  channelIdentity: '',
  remark: '',
  cancelType: null,
  cancelReasonType: null,
  cancelReason: '',
  rightsType: 0,
  createTime: '',
  orderItemVOs: [],
  logisticsVO: {
    logisticsType: 0,
    logisticsNo: '',
    logisticsStatus: null,
    logisticsCompanyCode: '',
    logisticsCompanyName: '',
    receiverAddressId: '',
    provinceCode: '',
    cityCode: '',
    countryCode: '',
    receiverProvince: '',
    receiverCity: '',
    receiverCountry: '',
    receiverArea: '',
    receiverAddress: '',
    receiverPostCode: '',
    receiverLongitude: '',
    receiverLatitude: '',
    receiverIdentity: '',
    receiverPhone: '',
    receiverName: '',
    expectArrivalTime: null,
    senderName: '',
    senderPhone: '',
    senderAddress: '',
    sendTime: null,
    arrivalTime: null,
  },
  paymentVO: {
    payStatus: 0,
    amount: '0',
    currency: null,
    payType: null,
    payWay: null,
    payWayName: null,
    interactId: null,
    traceNo: null,
    channelTrxNo: null,
    period: null,
    payTime: null,
    paySuccessTime: null,
  },
  buttonVOs: [],
  labelVOs: null,
  invoiceVO: null,
  couponAmount: '0',
  autoCancelTime: '0',
  orderStatusName: '',
  orderStatusRemark: '',
  logisticsLogVO: null,
  invoiceStatus: 0,
  invoiceDesc: '',
  invoiceUrl: null,
} as unknown) as OrderDetailView)
const _order = ref<NormalizedOrderData>({
  id: '',
  orderNo: '',
  parentOrderNo: '',
  storeId: '',
  storeName: '',
  status: 0,
  statusDesc: '',
  amount: '0',
  totalAmount: '0',
  logisticsNo: '',
  goodsList: [],
  buttons: [],
  createTime: '',
  receiverAddress: '',
  groupInfoVo: null,
})
const storeDetail = ref<StoreDetailState>({
  storeTel: '',
  storeBusiness: '',
})
const countDownTime = ref<number | null>(null)
const addressEditable = ref(false)
const backRefresh = ref(false)
const formatCreateTime = ref('')
const logisticsNodes = ref<LogisticsNodeItem[]>([])
const invoiceType = ref('不开发票')
const isPaid = ref(false)
const pullDownRefresh = ref<any>(null)

const orderDetailPageClass = `order-detail [width:100%] [box-sizing:border-box] [padding:0rpx_0rpx_calc(env(safe-area-inset-bottom)_+_144rpx)] [&_.count-down]:[color:#ffffff] [&_.header]:[width:100%] [&_.header]:[background-color:#ffffff] [&_.order-detail__header]:[width:700rpx] [&_.order-detail__header]:[height:200rpx] [&_.order-detail__header]:[border-radius:24rpx] [&_.order-detail__header]:[margin:0_auto] [&_.order-detail__header]:[overflow:hidden] [&_.order-detail__header]:[display:flex] [&_.order-detail__header]:[flex-direction:column] [&_.order-detail__header]:[align-items:center] [&_.order-detail__header]:[justify-content:center] [&_.order-detail__header]:[background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/template/order-bg.png')] [&_.order-detail__header]:[background-repeat:no-repeat] [&_.order-detail__header]:[background-size:contain] [&_.order-detail__header_.title]:[color:#ffffff] [&_.order-detail__header_.title]:[overflow:hidden] [&_.order-detail__header_.title]:[display:-webkit-box] [&_.order-detail__header_.title]:[-webkit-box-orient:vertical] [&_.order-detail__header_.desc]:[color:#ffffff] [&_.order-detail__header_.desc]:[overflow:hidden] [&_.order-detail__header_.desc]:[display:-webkit-box] [&_.order-detail__header_.desc]:[-webkit-box-orient:vertical] [&_.order-detail__header_.title]:[-webkit-line-clamp:1] [&_.order-detail__header_.title]:[font-size:44rpx] [&_.order-detail__header_.title]:[line-height:64rpx] [&_.order-detail__header_.title]:[margin-bottom:8rpx] [&_.order-detail__header_.title]:[font-weight:bold] [&_.order-detail__header_.desc]:[-webkit-line-clamp:2] [&_.order-detail__header_.desc]:[font-size:24rpx] [&_.order-detail__header_.desc]:[line-height:32rpx] [&_.order-detail__header_.desc_.count-down]:[display:inline] [&_.order-logistics]:[box-sizing:border-box] [&_.order-logistics]:[padding:32rpx] [&_.order-logistics]:[width:100%] [&_.order-logistics]:[background-color:#ffffff] [&_.order-logistics]:[overflow:hidden] [&_.order-logistics]:[color:#333333] [&_.order-logistics]:[font-size:32rpx] [&_.order-logistics]:[line-height:48rpx] [&_.order-logistics]:[display:flex] [&_.order-logistics]:[position:relative] [&_.border-bottom]:[margin:0_auto] [&_.border-bottom]:[width:686rpx] [&_.border-bottom]:[scale:1_0.5] [&_.border-bottom]:[height:2rpx] [&_.border-bottom]:[background-color:#e5e5e5] [&_.border-bottom-margin]:[margin:16rpx_auto] [&_.pay-detail]:[background-color:#ffffff] [&_.pay-detail]:[width:100%] [&_.pay-detail]:[box-sizing:border-box] [&_.padding-inline]:[padding:16rpx_32rpx] [&_.pay-detail_.pay-item]:[width:100%] [&_.pay-detail_.pay-item]:[height:72rpx] [&_.pay-detail_.pay-item]:[display:flex] [&_.pay-detail_.pay-item]:[align-items:center] [&_.pay-detail_.pay-item]:[justify-content:space-between] [&_.pay-detail_.pay-item]:[font-size:26rpx] [&_.pay-detail_.pay-item]:[line-height:36rpx] [&_.pay-detail_.pay-item]:[color:#666666] [&_.pay-detail_.pay-item]:[background-color:#ffffff] [&_.pay-detail_.pay-item_.pay-item__right]:[color:#333333] [&_.pay-detail_.pay-item_.pay-item__right]:[font-size:24rpx] [&_.pay-detail_.pay-item_.pay-item__right]:[display:flex] [&_.pay-detail_.pay-item_.pay-item__right]:[align-items:center] [&_.pay-detail_.pay-item_.pay-item__right]:[justify-content:flex-end] [&_.pay-detail_.pay-item_.pay-item__right]:[max-width:400rpx] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[display:-webkit-box] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[-webkit-box-orient:vertical] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[-webkit-line-clamp:2] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[max-width:400rpx] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[text-overflow:ellipsis] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[overflow:hidden] [&_.pay-detail_.pay-item_.font-bold]:[font-weight:bold] [&_.pay-detail_.pay-item_.primary]:[color:#fa4126] [&_.pay-detail_.pay-item_.max-size]:[font-size:36rpx] [&_.pay-detail_.pay-item_.max-size]:[line-height:48rpx] [&_.pay-detail_.pay-service]:[width:100%] [&_.pay-detail_.pay-service]:[height:72rpx] [&_.pay-detail_.pay-service]:[display:flex] [&_.pay-detail_.pay-service]:[align-items:center] [&_.pay-detail_.pay-service]:[justify-content:center] [&_.pay-detail_.pay-service]:[font-size:32rpx] [&_.pay-detail_.pay-service]:[line-height:36rpx] [&_.pay-detail_.pay-service]:[color:#333333] [&_.pay-detail_.pay-service]:[background-color:#ffffff]`
const orderLogisticsClass = `order-logistics [&_.logistics-icon]:[width:40rpx] [&_.logistics-icon]:[height:40rpx] [&_.logistics-icon]:[margin-right:16rpx] [&_.logistics-icon]:[margin-top:4rpx] [&_.logistics-content]:[flex:1] [&_.logistics-content_.logistics-time]:[font-size:28rpx] [&_.logistics-content_.logistics-time]:[line-height:40rpx] [&_.logistics-content_.logistics-time]:[color:#999999] [&_.logistics-content_.logistics-time]:[margin-top:12rpx] [&_.logistics-back]:[color:#999999] [&_.logistics-back]:[align-self:center] [&_.edit-text]:[color:#fa4126] [&_.edit-text]:[font-size:26rpx] [&_.edit-text]:[line-height:36rpx]`
const orderPayItemClass = `pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]`
const orderBottomBarClass = `bottom-bar [position:fixed] [left:0] [bottom:0] [right:0] [z-index:10] [background:#fff] [height:112rpx] [width:686rpx] [padding:0rpx_32rpx_env(safe-area-inset-bottom)] [display:flex] [align-items:center]`

function composeAddress(currentOrder: Pick<OrderDetailData, 'logisticsVO'>) {
  return [
    currentOrder.logisticsVO.receiverCity,
    currentOrder.logisticsVO.receiverCountry,
    currentOrder.logisticsVO.receiverArea,
    currentOrder.logisticsVO.receiverAddress,
  ].filter(Boolean).join(' ')
}

function flattenNodes(nodes: Array<{ title?: string, code?: string, nodes?: Array<{ status?: string, timestamp?: string | number }> }> = []) {
  return nodes.reduce<LogisticsNodeItem[]>((result, node) => {
    return (node.nodes || []).reduce<LogisticsNodeItem[]>((children, subNode, index) => {
      children.push({
        title: index === 0 ? node.title || '' : '',
        desc: subNode.status || '',
        date: formatTime(Number(subNode.timestamp || 0), 'YYYY-MM-DD HH:mm:ss'),
        icon: index === 0 && node.code ? (LogisticsIconMap as Record<string, string>)[node.code] || '' : '',
      })
      return children
    }, result)
  }, [])
}

function datermineInvoiceStatus(currentOrder: Pick<OrderDetailData, 'invoiceStatus'>) {
  return currentOrder.invoiceStatus
}

function computeCountDownTime(currentOrder: Pick<OrderDetailData, 'orderStatus' | 'autoCancelTime'>) {
  if (currentOrder.orderStatus !== OrderStatus.PENDING_PAYMENT) {
    return null
  }
  const autoCancelTime = Number(currentOrder.autoCancelTime || 0)
  return autoCancelTime > 1577808000000 ? autoCancelTime - Date.now() : autoCancelTime
}

function normalizeOrder(currentOrder: OrderDetailView): NormalizedOrderData {
  return {
    id: currentOrder.orderId,
    orderNo: currentOrder.orderNo,
    parentOrderNo: currentOrder.parentOrderNo,
    storeId: currentOrder.storeId,
    storeName: currentOrder.storeName,
    status: currentOrder.orderStatus,
    statusDesc: currentOrder.orderStatusName,
    amount: currentOrder.paymentAmount,
    totalAmount: currentOrder.goodsAmountApp,
    logisticsNo: currentOrder.logisticsVO.logisticsNo,
    goodsList: (currentOrder.orderItemVOs || []).map(goods => ({
      ...goods,
      id: goods.id,
      thumb: goods.goodsPictureUrl,
      title: goods.goodsName,
      skuId: goods.skuId,
      spuId: goods.spuId,
      specs: (goods.specifications || []).map(spec => spec.specValue),
      price: goods.tagPrice || goods.actualPrice,
      num: goods.buyQuantity,
      titlePrefixTags: goods.tagText ? [{ text: goods.tagText }] : [],
      buttons: goods.buttonVOs || [],
    })),
    buttons: currentOrder.buttonVOs || [],
    createTime: currentOrder.createTime,
    receiverAddress: composeAddress(currentOrder),
    groupInfoVo: currentOrder.groupInfoVo,
  }
}

async function getDetail() {
  const res = await fetchOrderDetail({
    parameter: orderNo.value,
  })
  const currentOrder = res.data as OrderDetailView
  order.value = currentOrder
  _order.value = normalizeOrder(currentOrder)
  formatCreateTime.value = formatTime(Number(currentOrder.createTime || 0), 'YYYY-MM-DD HH:mm')
  countDownTime.value = computeCountDownTime(currentOrder)
  addressEditable.value = [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_DELIVERY].includes(currentOrder.orderStatus) && currentOrder.orderSubStatus !== -1
  isPaid.value = Boolean(currentOrder.paymentVO.paySuccessTime)
  datermineInvoiceStatus(currentOrder)
  invoiceType.value = currentOrder.invoiceVO?.invoiceType === 5 ? '电子普通发票' : '不开发票'
  logisticsNodes.value = flattenNodes(currentOrder.trajectoryVos || [])
}

async function getStoreDetail() {
  const res: BusinessTimeResult = await fetchBusinessTime()
  storeDetail.value = {
    storeTel: res.data.telphone,
    storeBusiness: res.data.businessTime.join('\n'),
  }
}

async function init() {
  pageLoading.value = true
  try {
    await Promise.all([
      getStoreDetail(),
      getDetail(),
    ])
  }
  finally {
    pageLoading.value = false
  }
}

function onRefresh() {
  void init()
  const pages = getCurrentPages() as PageInstanceWithBackRefresh[]
  const lastPage = pages[pages.length - 2]
  if (lastPage) {
    lastPage.data.backRefresh = true
  }
}

async function onPullDownRefresh_(e: { detail?: { callback?: () => void } }) {
  await getDetail()
  e.detail?.callback?.()
}

function onCountDownFinish() {
  if ((countDownTime.value || 0) > 0 || (order.value.groupInfoVo?.residueTime || 0) > 0) {
    onRefresh()
  }
}

async function onGoodsCardTap(e: { currentTarget?: { dataset?: { index?: number | string } } }) {
  const index = Number(e.currentTarget?.dataset?.index ?? 0)
  const goods = order.value.orderItemVOs[index]
  if (!goods) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/goods/details/index?spuId=${goods.spuId}`,
  })
}

function normalizeSelectedAddress(address: SelectableAddress) {
  return {
    name: address.name,
    phone: address.phone,
    receiverAddress: address.detailAddress,
  }
}

async function onEditAddressTap() {
  void getAddressPromise().then((address) => {
    if (!address) {
      return
    }
    const nextAddress = normalizeSelectedAddress(address)
    order.value = {
      ...order.value,
      logisticsVO: {
        ...order.value.logisticsVO,
        receiverName: nextAddress.name,
        receiverPhone: nextAddress.phone as string,
      },
    } as OrderDetailView
    _order.value = {
      ..._order.value,
      receiverAddress: nextAddress.receiverAddress,
    }
  }).catch(() => {})
  await wpi.navigateTo({
    url: `/pages/user/address/list/index?selectMode=1`,
  })
}

async function onOrderNumCopy() {
  await wpi.setClipboardData({
    data: order.value.orderNo,
  })
}

async function onDeliveryClick() {
  const logisticsData = {
    nodes: logisticsNodes.value,
    company: order.value.logisticsVO.logisticsCompanyName,
    logisticsNo: order.value.logisticsVO.logisticsNo,
    phoneNumber: (order.value.logisticsVO as any).logisticsCompanyTel,
  }
  await wpi.navigateTo({
    url: `/pages/order/delivery-detail/index?data=${encodeURIComponent(JSON.stringify(logisticsData))}`,
  })
}

function clickService() {
  showToast({
    message: '您点击了联系客服',
  })
}

async function onOrderInvoiceView() {
  await wpi.navigateTo({
    url: `/pages/order/invoice/index?orderNo=${orderNo.value}`,
  })
}

function onOpenCoupons() {}

onLoad((query: QueryOptions = {}) => {
  orderNo.value = query.orderNo || ''
  pullDownRefresh.value = nativeInstance.selectComponent?.('#t-pull-down-refresh') ?? null
  void init()
})

onShow(() => {
  if (!backRefresh.value) {
    return
  }
  onRefresh()
  backRefresh.value = false
})

onPageScroll((e) => {
  pullDownRefresh.value?.onPageScroll?.(e)
})

definePageJson({
  navigationBarTitleText: '订单详情',
  usingComponents: {
    't-pull-down-refresh': 'tdesign-miniprogram/pull-down-refresh/pull-down-refresh',
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-image': '/components/webp-image/index',
    't-count-down': 'tdesign-miniprogram/count-down/count-down',
    'price': '/components/price/index',
    'order-card': '../components/order-card/index',
    'order-goods-card': '../components/order-goods-card/index',
    'order-button-bar': '../components/order-button-bar/index',
  },
})
</script>

<template>
  <t-pull-down-refresh id="t-pull-down-refresh" t-class-indicator="t-class-indicator" @refresh="onPullDownRefresh_">
    <!-- 页面内容 -->
    <view :class="orderDetailPageClass">
      <view class="header">
        <view class="order-detail__header">
          <view class="title">
            {{ _order.statusDesc }}
          </view>
          <view class="desc">
            <block v-if="order.holdStatus === 1">
              <block v-if="order.groupInfoVo?.residueTime && order.groupInfoVo.residueTime > 0">
                拼团剩余
                <t-count-down
                  :time="order.groupInfoVo.residueTime"
                  format="HH小时mm分ss秒"
                  t-class="count-down"
                  @finish="onCountDownFinish"
                />
                <view>过时自动取消</view>
              </block>
            </block>
            <block v-else-if="countDownTime === null">
              {{ order.orderStatusRemark || '' }}
            </block>
            <block v-else-if="countDownTime > 0">
              剩
              <t-count-down
                :time="countDownTime"
                format="HH小时mm分ss秒"
                t-class="count-down"
                @finish="onCountDownFinish"
              />
              支付，过时订单将会取消
            </block>
            <block v-else>
              超时未支付
            </block>
          </view>
        </view>

        <!-- 物流 -->
        <view v-if="logisticsNodes[0]" :class="orderLogisticsClass" @tap="onDeliveryClick">
          <t-icon name="deliver" size="40rpx" class="logistics-icon" prefix="wr" />
          <view class="logistics-content">
            <view>{{ logisticsNodes[0].desc }}</view>
            <view class="logistics-time">
              {{ logisticsNodes[0].date }}
            </view>
          </view>
          <t-icon class="logistics-back" name="arrow_forward" size="36rpx" prefix="wr" />
        </view>
        <view v-if="logisticsNodes[0]" class="border-bottom" />
        <!-- 收货地址 -->
        <view :class="orderLogisticsClass">
          <t-icon name="location" size="40rpx" class="logistics-icon" prefix="wr" />
          <view class="logistics-content">
            <view>{{ `${order.logisticsVO.receiverName} ` }}{{ order.logisticsVO.receiverPhone }}</view>
            <view class="logistics-time">
              {{ _order.receiverAddress }}
            </view>
          </view>
          <view v-if="addressEditable" class="edit-text" @tap="onEditAddressTap">
            修改
          </view>
        </view>
      </view>
      <!-- 店铺及商品 -->
      <order-card :order="_order" use-top-right-slot>
        <order-goods-card
          v-for="(goods, gIndex) in _order.goodsList"
          :key="goods.id || gIndex"
          :goods="goods"
          :no-top-line="gIndex === 0"
          :data-index="gIndex"
          @tap="onGoodsCardTap"
        >
          <template #append-card>
            <order-button-bar

              class="goods-button-bar [height:112rpx] [width:686rpx] [margin-bottom:16rpx]"
              :order="_order"
              :goodsIndex="gIndex"
              @refresh="onRefresh"
            />
          </template>
        </order-goods-card>
        <view class="pay-detail">
          <view :class="orderPayItemClass">
            <text>商品总额</text>
            <price fill decimalSmaller wr-class="pay-item__right font-bold" :price="order.totalAmount || '0'" />
          </view>
          <view :class="orderPayItemClass">
            <text>运费</text>
            <view class="pay-item__right font-bold">
              <block v-if="order.freightFee">
                +
                <price fill decimalSmaller :price="order.freightFee" />
              </block>
              <text v-else>
                免运费
              </text>
            </view>
          </view>
          <view :class="orderPayItemClass">
            <text>活动优惠</text>
            <view class="pay-item__right primary font-bold">
              -
              <price fill :price="order.discountAmount || 0" />
            </view>
          </view>
          <view :class="orderPayItemClass">
            <text>优惠券</text>
            <view class="pay-item__right" @tap.stop="onOpenCoupons">
              <block v-if="order.couponAmount">
                -
                <price fill decimalSmaller :price="order.couponAmount" />
              </block>
              <text v-else>
                无可用
              </text>
            <!-- <t-icon name="chevron-right" size="32rpx" color="#BBBBBB" /> -->
            </view>
          </view>
          <view :class="orderPayItemClass">
            <text>{{ isPaid ? '实付' : '应付' }}</text>
            <price
              fill
              decimalSmaller
              wr-class="pay-item__right font-bold primary max-size"
              :price="order.paymentAmount || '0'"
            />
          </view>
        </view>
      </order-card>
      <view class="pay-detail padding-inline">
        <view :class="orderPayItemClass">
          <text>订单编号</text>
          <view class="pay-item__right" @tap="onOrderNumCopy">
            <text class="order-no">
              {{ order.orderNo }}
            </text>
            <view class="pay-item__right__copy">
              复制
            </view>
          </view>
        </view>
        <view :class="orderPayItemClass">
          <text>下单时间</text>
          <view class="pay-item__right">
            <text class="order-no normal-color">
              {{ formatCreateTime }}
            </text>
          </view>
        </view>
        <view class="border-bottom border-bottom-margin" />
        <view :class="orderPayItemClass">
          <text>发票</text>
          <view class="pay-item__right" @tap="onOrderInvoiceView">
            <text class="order-no normal-color">
              {{ invoiceType }}
            </text>
            <view class="pay-item__right__copy">
              查看
            </view>
          </view>
        </view>
        <view :class="orderPayItemClass">
          <text>备注</text>
          <view class="pay-item__right">
            <text class="order-no normal-color">
              {{ order.remark || '-' }}
            </text>
          </view>
        </view>
        <view class="border-bottom border-bottom-margin" />
        <view v-if="storeDetail && storeDetail.storeTel" class="pay-service" @tap.stop="clickService">
          <t-icon name="service" size="40rpx" />
          <text :decode="true">
            &nbsp;联系客服
          </text>
        </view>
      </view>
    </view>
    <view v-if="_order.buttons.length > 0" :class="orderBottomBarClass">
      <order-button-bar :order="_order" isBtnMax @refresh="onRefresh" />
    </view>
  </t-pull-down-refresh>
</template>
