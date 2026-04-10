<script setup lang="ts">
import type { RightsDetailResult } from './api'
import { onLoad, onShow, ref } from 'wevu'
import { wpi } from 'wevu/api'
import { ServiceStatus, ServiceType, ServiceTypeDesc } from '../config'
import { formatTime, getRightsDetail } from './api'

interface QueryOptions {
  rightsNo?: string
}

type ServiceRawItem = RightsDetailResult['data'][number]

interface ServiceGoodsItem {
  id: number
  thumb: string
  title: string
  specs: string[]
  itemRefundAmount: number
  rightsQuantity: number
}

interface ServiceViewItem {
  id: string
  serviceNo: string
  storeName: string
  type: number
  typeDesc: string
  status: number
  statusIcon: string
  statusName: string
  statusDesc: string
  amount: number
  goodsList: ServiceGoodsItem[]
  orderNo: string
  rightsNo: string
  rightsReasonDesc: string
  isRefunded: boolean
  refundMethodList: Array<{ name: string, amount: number }>
  refundRequestAmount: number
  payTraceNo: string
  createTime: string
  logisticsNo: string
  logisticsCompanyName: string
  logisticsCompanyCode: string
  remark: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  applyRemark: string
  buttons: NonNullable<ServiceRawItem['buttonVOs']>
  logistics: ServiceRawItem['logisticsVO']
}

const rightsNo = ref('')
const pageLoading = ref(true)
const serviceRaw = ref<ServiceRawItem | null>(null)
const service = ref<ServiceViewItem>({
  id: '',
  serviceNo: '',
  storeName: '',
  type: ServiceType.ONLY_REFUND,
  typeDesc: '',
  status: 0,
  statusIcon: 'goods_return',
  statusName: '',
  statusDesc: '',
  amount: 0,
  goodsList: [],
  orderNo: '',
  rightsNo: '',
  rightsReasonDesc: '',
  isRefunded: false,
  refundMethodList: [],
  refundRequestAmount: 0,
  payTraceNo: '',
  createTime: '',
  logisticsNo: '',
  logisticsCompanyName: '',
  logisticsCompanyCode: '',
  remark: '',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  applyRemark: '',
  buttons: [],
  logistics: {} as ServiceRawItem['logisticsVO'],
})
const gallery = ref({
  current: 0,
  show: false,
  proofs: [] as string[],
})
const showProofs = ref(false)
const backRefresh = ref(false)
const inputDialogVisible = ref(false)
const amountTip = ref('')

function composeAddress(currentService: ServiceRawItem) {
  return [
    currentService.logisticsVO.receiverProvince,
    currentService.logisticsVO.receiverCity,
    currentService.logisticsVO.receiverCountry,
    currentService.logisticsVO.receiverArea,
    currentService.logisticsVO.receiverAddress,
  ].filter(Boolean).join(' ')
}

function genStatusIcon(item: ServiceRawItem['rights']) {
  const { userRightsStatus, afterSaleRequireType } = item
  switch (userRightsStatus) {
    case ServiceStatus.REFUNDED:
      return 'succeed'
    case ServiceStatus.CLOSED:
      return 'indent_close'
    default:
      switch (afterSaleRequireType) {
        case 'REFUND_MONEY':
          return 'goods_refund'
        case 'REFUND_GOODS_MONEY':
          return 'goods_return'
        default:
          return 'goods_return'
      }
  }
}

function normalizeService(currentServiceRaw: ServiceRawItem): ServiceViewItem {
  return {
    id: currentServiceRaw.rights.rightsNo,
    serviceNo: currentServiceRaw.rights.rightsNo,
    storeName: currentServiceRaw.rights.storeName,
    type: currentServiceRaw.rights.rightsType,
    typeDesc: ServiceTypeDesc[currentServiceRaw.rights.rightsType],
    status: currentServiceRaw.rights.rightsStatus,
    statusIcon: genStatusIcon(currentServiceRaw.rights),
    statusName: currentServiceRaw.rights.userRightsStatusName,
    statusDesc: currentServiceRaw.rights.userRightsStatusDesc,
    amount: currentServiceRaw.rights.refundRequestAmount,
    goodsList: (currentServiceRaw.rightsItem || []).map((item, index) => ({
      id: index,
      thumb: item.goodsPictureUrl,
      title: item.goodsName,
      specs: (item.specInfo || []).map(spec => spec.specValues || ''),
      itemRefundAmount: item.itemRefundAmount,
      rightsQuantity: item.rightsQuantity,
    })),
    orderNo: currentServiceRaw.rights.orderNo,
    rightsNo: currentServiceRaw.rights.rightsNo,
    rightsReasonDesc: currentServiceRaw.rights.rightsReasonDesc,
    isRefunded: currentServiceRaw.rights.userRightsStatus === ServiceStatus.REFUNDED,
    refundMethodList: (currentServiceRaw.refundMethodList || []).map(item => ({
      name: item.refundMethodName,
      amount: item.refundMethodAmount,
    })),
    refundRequestAmount: currentServiceRaw.rights.refundRequestAmount,
    payTraceNo: currentServiceRaw.rightsRefund.traceNo,
    createTime: formatTime(Number(currentServiceRaw.rights.createTime || 0), 'YYYY-MM-DD HH:mm'),
    logisticsNo: currentServiceRaw.logisticsVO.logisticsNo,
    logisticsCompanyName: currentServiceRaw.logisticsVO.logisticsCompanyName,
    logisticsCompanyCode: currentServiceRaw.logisticsVO.logisticsCompanyCode,
    remark: currentServiceRaw.logisticsVO.remark || '',
    receiverName: currentServiceRaw.logisticsVO.receiverName,
    receiverPhone: currentServiceRaw.logisticsVO.receiverPhone,
    receiverAddress: composeAddress(currentServiceRaw),
    applyRemark: currentServiceRaw.rightsRefund.refundDesc || '',
    buttons: currentServiceRaw.buttonVOs || [],
    logistics: currentServiceRaw.logisticsVO,
  }
}

async function getService() {
  const res = await getRightsDetail({
    rightsNo: rightsNo.value,
  })
  const currentServiceRaw = res.data[0]
  if (!currentServiceRaw) {
    return
  }
  serviceRaw.value = currentServiceRaw
  service.value = normalizeService(currentServiceRaw)
  gallery.value = {
    ...gallery.value,
    proofs: currentServiceRaw.rights.rightsImageUrls || [],
  }
  showProofs.value = currentServiceRaw.rights.userRightsStatus === ServiceStatus.PENDING_VERIFY
    && Boolean(service.value.applyRemark || gallery.value.proofs.length > 0)
  await wpi.setNavigationBarTitle({
    title: {
      [ServiceType.ORDER_CANCEL]: '退款详情',
      [ServiceType.ONLY_REFUND]: '退款详情',
      [ServiceType.RETURN_GOODS]: '退货退款详情',
    }[service.value.type],
  })
}

async function init() {
  pageLoading.value = true
  try {
    await getService()
  }
  finally {
    pageLoading.value = false
  }
}

async function onPullDownRefresh_(e: { detail?: { callback?: () => void } }) {
  await getService()
  e.detail?.callback?.()
}

function onProofTap(e: { currentTarget?: { dataset?: { index?: number | string } } }) {
  if (gallery.value.show) {
    gallery.value = {
      ...gallery.value,
      show: false,
    }
    return
  }
  gallery.value = {
    ...gallery.value,
    show: true,
    current: Number(e.currentTarget?.dataset?.index ?? 0),
  }
}

async function onGoodsCardTap(e: { currentTarget?: { dataset?: { index?: number | string } } }) {
  const index = Number(e.currentTarget?.dataset?.index ?? 0)
  const goods = serviceRaw.value?.rightsItem?.[index]
  if (!goods) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/goods/details/index?skuId=${goods.skuId}`,
  })
}

async function onServiceNoCopy() {
  await wpi.setClipboardData({
    data: service.value.serviceNo,
  })
}

async function onAddressCopy() {
  await wpi.setClipboardData({
    data: `${service.value.receiverName}  ${service.value.receiverPhone}\n${service.value.receiverAddress}`,
  })
}

onLoad((query: QueryOptions = {}) => {
  rightsNo.value = query.rightsNo || ''
  void init()
})

onShow(() => {
  if (!backRefresh.value) {
    return
  }
  void init()
  backRefresh.value = false
})

definePageJson({
  navigationBarTitleText: '',
  usingComponents: {
    'wr-loading-content': '/components/loading-content/index',
    'wr-price': '/components/price/index',
    'wr-service-goods-card': '../components/order-goods-card/index',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-pull-down-refresh': 'tdesign-miniprogram/pull-down-refresh/pull-down-refresh',
    't-grid': 'tdesign-miniprogram/grid/grid',
    't-grid-item': 'tdesign-miniprogram/grid-item/grid-item',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-input': 'tdesign-miniprogram/input/input',
    't-swiper': 'tdesign-miniprogram/swiper/swiper',
    't-swiper-nav': 'tdesign-miniprogram/swiper-nav/swiper-nav',
    'wr-after-service-button-bar': '../components/after-service-button-bar/index',
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <wr-loading-content v-if="pageLoading" position="fixed" type="spinner" />
  <view class="page-container [&_.wr-goods-card__specs]:[margin:14rpx_20rpx_0_0] [&_.order-card_.header_.store-name]:[-webkit-line-clamp:1] [&_.order-card_.header_.store-name]:[display:-webkit-box] [&_.order-card_.header_.store-name]:[-webkit-box-orient:vertical] [&_.order-card_.header_.store-name]:[overflow:hidden] [&_.order-card_.header_.store-name]:[width:80%] [&_.status-desc]:[box-sizing:border-box] [&_.status-desc]:[padding:22rpx_20rpx] [&_.status-desc]:[font-size:26rpx] [&_.status-desc]:[line-height:1.3] [&_.status-desc]:[text-align:left] [&_.status-desc]:[color:#333333] [&_.status-desc]:[background-color:#f5f5f5] [&_.status-desc]:[border-radius:8rpx] [&_.status-desc]:[word-wrap:break-word] [&_.status-desc]:[margin-top:40rpx] [&_.status-desc]:[margin-bottom:20rpx] [&_.header__right]:[font-size:24rpx] [&_.header__right]:[color:#333333] [&_.header__right]:[display:flex] [&_.header__right]:[align-items:center] [&_.header__right__icon]:[color:#d05b27] [&_.header__right__icon]:[font-size:16px] [&_.header__right__icon]:[margin-right:10rpx] [&_.wr-goods-card__thumb]:[width:140rpx] [&_.page-background]:[position:absolute] [&_.page-background]:[z-index:-1] [&_.page-background]:[top:0] [&_.page-background]:[left:0] [&_.page-background]:[width:100vw] [&_.page-background]:[color:#fff] [&_.page-background]:[overflow:hidden] [&_.page-background-img]:[width:100%] [&_.page-background-img]:[height:320rpx] [&_.navbar-bg_.nav-back]:[background:linear-gradient(to_right,_rgba(250,_85,_15,_1)_0%,_rgba(250,_85,_15,_0.6)_100%)] [&_.navbar-bg_.page-background]:[background:linear-gradient(to_right,_rgba(250,_85,_15,_1)_0%,_rgba(250,_85,_15,_0.6)_100%)] [&_.navigation-bar__btn]:[font-size:40rpx] [&_.navigation-bar__btn]:[font-weight:bold] [&_.navigation-bar__btn]:[color:#333] [&_.navigation-bar__inner_.navigation-bar__left]:[padding-left:16rpx]">
    <t-pull-down-refresh id="t-pull-down-refresh" t-class-indicator="t-class-indicator" @refresh="onPullDownRefresh_">
      <!-- 页面内容 -->
      <view class="service-detail safe-bottom [position:relative] [padding-bottom:env(safe-area-inset-bottom)] [&_.wr-goods-card__body]:[margin-left:50rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-size:36rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-size:28rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-size:24rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-family:DIN_Alternate] [&_.service-detail__header]:[padding:60rpx_0_48rpx_40rpx] [&_.service-detail__header]:[box-sizing:border-box] [&_.service-detail__header]:[height:220rpx] [&_.service-detail__header]:[background-color:#fff] [&_.service-detail__header_.title]:[overflow:hidden] [&_.service-detail__header_.title]:[display:-webkit-box] [&_.service-detail__header_.title]:[-webkit-box-orient:vertical] [&_.service-detail__header_.desc]:[overflow:hidden] [&_.service-detail__header_.desc]:[display:-webkit-box] [&_.service-detail__header_.desc]:[-webkit-box-orient:vertical] [&_.service-detail__header_.title]:[-webkit-line-clamp:1] [&_.service-detail__header_.title]:[font-size:48rpx] [&_.service-detail__header_.title]:[font-weight:bold] [&_.service-detail__header_.title]:[color:#333] [&_.service-detail__header_.title]:[display:flex] [&_.service-detail__header_.desc]:[-webkit-line-clamp:2] [&_.service-detail__header_.desc]:[margin-top:10rpx] [&_.service-detail__header_.desc]:[font-size:28rpx] [&_.service-detail__header_.desc]:[color:#999] [&_.service-detail__header_.desc_.count-down]:[color:#fff185] [&_.service-detail__header_.desc_.count-down]:[display:inline] [&_.service-section]:[margin:20rpx_0_20rpx_0] [&_.service-section]:[width:auto] [&_.service-section]:[border-radius:8rpx] [&_.service-section]:[background-color:white] [&_.service-section]:[overflow:hidden] [&_.service-section__title]:[color:#333333] [&_.service-section__title]:[margin-bottom:10rpx] [&_.service-section__title]:[padding-bottom:18rpx] [&_.service-section__title]:[height:224rpx] [&_.service-section__title]:[position:relative] [&_.service-section__title_.icon]:[margin-right:16rpx] [&_.service-section__title_.icon]:[font-size:40rpx] [&_.service-section__title_.right]:[flex:none] [&_.service-section__title_.right]:[font-weight:normal] [&_.service-section__title_.right]:[font-size:26rpx] [&_.section-content]:[margin:16rpx_0_0_52rpx] [&_.main]:[font-size:28rpx] [&_.main]:[color:#222427] [&_.main]:[font-weight:bold] [&_.main_.phone-num]:[margin-left:16rpx] [&_.main_.phone-num]:[display:inline] [&_.label]:[color:#999999] [&_.label]:[font-size:26rpx] [&_.custom-remark]:[font-size:26rpx] [&_.custom-remark]:[line-height:36rpx] [&_.custom-remark]:[color:#333333] [&_.custom-remark]:[word-wrap:break-word] [&_.proofs]:[margin-top:20rpx] [&_.proofs_.proof]:[width:100%] [&_.proofs_.proof]:[height:100%] [&_.proofs_.proof]:[background-color:#f9f9f9] [&_.pay-result_.t-cell-title]:[color:#666666] [&_.pay-result_.t-cell-title]:[font-size:28rpx] [&_.pay-result_.t-cell-value]:[color:#666666] [&_.pay-result_.t-cell-value]:[font-size:28rpx] [&_.pay-result_.wr-cell__value]:[font-weight:bold] [&_.right]:[font-size:36rpx] [&_.right]:[color:#fa550f] [&_.right]:[font-weight:bold] [&_.title]:[font-weight:bold] [&_.pay-result_.service-section__title_.right_.integer]:[font-size:48rpx] [&_.pay-result_.split-line]:[position:relative] [&_.pay-result_.section-content]:[margin-left:0] [&_.pay-result_.section-content_.label]:[color:#999999] [&_.pay-result_.section-content_.label]:[font-size:24rpx] [&_.footer-bar-wrapper]:[height:100rpx] [&_.footer-bar-wrapper_.footer-bar]:[position:fixed] [&_.footer-bar-wrapper_.footer-bar]:[left:0] [&_.footer-bar-wrapper_.footer-bar]:[bottom:0] [&_.footer-bar-wrapper_.footer-bar]:[height:100rpx] [&_.footer-bar-wrapper_.footer-bar]:[width:100vw] [&_.footer-bar-wrapper_.footer-bar]:[box-sizing:border-box] [&_.footer-bar-wrapper_.footer-bar]:[padding:0_20rpx] [&_.footer-bar-wrapper_.footer-bar]:[background-color:white] [&_.footer-bar-wrapper_.footer-bar]:[display:flex] [&_.footer-bar-wrapper_.footer-bar]:[justify-content:space-between] [&_.footer-bar-wrapper_.footer-bar]:[align-items:center] [&_.text-btn]:[display:inline] [&_.text-btn]:[box-sizing:border-box] [&_.text-btn]:[color:#333] [&_.text-btn]:[border:2rpx_solid_#ddd] [&_.text-btn]:[border-radius:32rpx] [&_.text-btn]:[margin-left:10rpx] [&_.text-btn]:[padding:0_16rpx] [&_.text-btn]:[font-weight:normal] [&_.text-btn]:[font-size:24rpx] [&_.text-btn]:[line-height:32rpx] [&_.text-btn--active]:[opacity:0.5] [&_.specs-popup_.bottom-btn]:[color:#fa550f] [&_.logistics]:[padding-top:0] [&_.logistics]:[padding-bottom:0] [&_.logistics]:[padding-right:0] [&_.goods-refund-address]:[padding-top:0] [&_.goods-refund-address]:[padding-bottom:0] [&_.goods-refund-address_.goods-refund-address-copy-btn]:[position:absolute] [&_.goods-refund-address_.goods-refund-address-copy-btn]:[top:22rpx] [&_.goods-refund-address_.goods-refund-address-copy-btn]:[right:32rpx] [&_.service-goods-card-wrap]:[padding:0_32rpx]">
        <!-- 状态及描述 -->
        <view class="service-detail__header">
          <view class="title">
            <t-icon prefix="wr" :name="service.statusIcon" size="30px" />
            {{ service.statusName }}
          </view>
          <view class="desc">
            {{ service.statusDesc }}
          </view>
        </view>
        <!-- 退款金额 -->
        <view v-if="service.isRefunded" class="service-section__pay pay-result [margin:0_0_20rpx_0] [width:auto] [border-radius:8rpx] [background-color:white] [overflow:hidden] [&_.credential_desc]:[padding:0_24rpx] [&_.t-grid-item__content]:[padding:0_0_24rpx]">
          <t-cell
            t-class-title="title"
            t-class-note="right"
            t-class="t-class-wrapper-first-child ![padding:24rpx]"
            :title="service.isRefunded ? '退款金额' : '预计退款金额'"
            :bordered="false"
          >
            <template #note>
              <wr-price :price="service.refundRequestAmount" fill />
            </template>
          </t-cell>
          <t-cell
            v-for="(item, index) in service.refundMethodList"
            :key="item.name || index"
            t-class-title="t-cell-title"
            t-class-note="t-cell-title"
            t-class="t-class-wrapper ![padding:10rpx_24rpx]"
            :title="item.name"
            :bordered="service.refundMethodList.length - 1 === index ? true : false"
          >
            <template #note>
              <wr-price :price="item.amount" fill />
            </template>
          </t-cell>
          <block v-if="service.isRefunded">
            <t-cell
              title=""
              t-class="t-class-wrapper-first-child ![padding:24rpx]"
              t-class-description="label"
              description="说明：微信退款后，可以在微信支付账单查询，实际退款到时间可能受到银行处理时间的影响有一定延时，可以稍后查看"
            />
          </block>
        </view>
        <!-- 物流 -->
        <view v-if="service.logisticsNo" class="service-section logistics">
          <view class="service-section__title">
            <t-cell
              align="top"
              :title="`${service.logisticsCompanyName} ${service.logisticsNo}`"
              :bordered="false"
              description="买家已寄出"
              arrow
            >
              <template #left-icon>
                <t-icon prefix="wr" color="#333333" name="deliver" size="40rpx" />
              </template>
            </t-cell>
            <view style="padding: 0 32rpx">
              <wr-after-service-button-bar :service="service" />
            </view>
          </view>
        </view>
        <!-- 收货地址 -->
        <view v-if="service.receiverName" class="service-section goods-refund-address">
          <t-cell-group>
            <t-cell align="top" title="退货地址" :bordered="false">
              <template #left-icon>
                <t-icon prefix="wr" color="#333333" name="location" size="40rpx" />
              </template>
              <template #note>
                <view

                  class="right text-btn goods-refund-address-copy-btn"
                  hover-class="text-btn--active"
                  @tap="onAddressCopy"
                >
                  复制
                </view>
              </template>
              <template #description>
                <view>
                  <view> {{ service.receiverAddress }} </view>
                  <view>收货人：{{ service.receiverName }}</view>
                  <view>收货人手机：{{ service.receiverPhone }}</view>
                </view>
              </template>
            </t-cell>
          </t-cell-group>
        </view>
        <!-- 商品卡片 -->
        <view
          v-if="service.goodsList && service.goodsList.length > 0"
          class="service-section service-goods-card-wrap"
        >
          <wr-service-goods-card
            v-for="(goods, index) in service.goodsList"
            :key="goods.id || index"
            :goods="goods"
            no-top-line
            :data-index="index"
            @tap="onGoodsCardTap"
          >
            <template #footer>
              <view class="order-goods-card-footer [display:flex] [width:calc(100%_-_190rpx)] [justify-content:space-between] [position:absolute] [bottom:20rpx] [left:190rpx]">
                <wr-price
                  :price="goods.itemRefundAmount"
                  fill
                  wr-class="order-goods-card-footer-price-class"
                  symbol-class="order-goods-card-footer-price-symbol"
                  decimal-class="order-goods-card-footer-price-decimal"
                />
                <view class="order-goods-card-footer-num [color:#999] [line-height:40rpx]">
                  x {{ goods.rightsQuantity }}
                </view>
              </view>
            </template>
          </wr-service-goods-card>
        </view>
        <!-- 退款信息 -->
        <view class="service-section__pay [margin:0_0_20rpx_0] [width:auto] [border-radius:8rpx] [background-color:white] [overflow:hidden] [&_.credential_desc]:[padding:0_24rpx] [&_.t-grid-item__content]:[padding:0_0_24rpx]">
          <t-cell :bordered="false" title="退款信息" t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]" t-class-title="t-refund-title" />
          <t-cell
            :bordered="false"
            t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
            t-class-title="t-refund-info"
            t-class-note="t-refund-note"
            title="订单编号"
            :note="service.orderNo"
          />
          <t-cell
            :bordered="false"
            t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
            t-class-title="t-refund-info"
            t-class-note="t-refund-note"
            title="服务单号"
            :note="service.rightsNo"
          >
            <template #right-icon>
              <view class="text-btn" hover-class="text-btn--active" @tap="onServiceNoCopy">
                复制
              </view>
            </template>
          </t-cell>
          <t-cell
            :bordered="false"
            t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
            t-class-title="t-refund-info"
            t-class-note="t-refund-note"
            title="退款原因"
            :note="service.rightsReasonDesc"
          />
          <t-cell
            :bordered="false"
            t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
            t-class-title="t-refund-info"
            t-class-note="t-refund-note"
            title="退款金额"
          >
            <template #note>
              <wr-price :price="service.refundRequestAmount" fill />
            </template>
          </t-cell>
          <t-cell
            :bordered="false"
            t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
            t-class-title="t-refund-info"
            t-class-note="t-refund-note"
            title="申请时间"
            :note="service.createTime"
          />
        </view>
        <!-- 凭证/说明 -->
        <view v-if="showProofs" class="service-section__pay credential_desc [margin:0_0_20rpx_0] [width:auto] [border-radius:8rpx] [background-color:white] [overflow:hidden] [padding:0_24rpx] [&_.credential_desc]:[padding:0_24rpx] [&_.t-grid-item__content]:[padding:0_0_24rpx]">
          <t-cell
            :bordered="false"
            title="凭证/说明"
            t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
            t-class-title="t-refund-info"
            :description="service.applyRemark"
          />
          <t-grid :border="false" :column="3">
            <t-grid-item
              v-for="(item, index) in gallery.proofs"
              :key="index"
              t-class-image="t-refund-grid-image"
              :image="item"
              :data-index="index"
              @click="onProofTap"
            />
          </t-grid>
        </view>
        <t-swiper
          v-if="gallery.show"
          :current="gallery.current"
          :img-srcs="gallery.proofs"
          full-screen
          :circular="false"
          @tap="onProofTap"
        />
      </view>
    </t-pull-down-refresh>
  </view>
  <!-- 退款说明填写 -->
  <t-dialog id="input-dialog" :visible="inputDialogVisible">
    <template #content>
      <view class="input-dialog__content">
        <view style=" padding-left: 32rpx;color: #333">
          物流单号
        </view>
        <t-input class="input" placeholder="请输入物流单号" />
        <view class="tips">
          {{ amountTip }}
        </view>
      </view>
    </template>
  </t-dialog>
</template>
