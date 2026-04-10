<script setup lang="ts">
import type { Address, DeliveryAddress } from '../../../model/address'
import type { SettleDetailResult } from '../../../model/order/orderConfirm'
import type { SelectableAddress } from '../../../services/address/list'
import type { InvoiceData, StoreInfoItem } from './helpers'
import { computed, onLoad, onShow, ref } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { getAddressPromise } from '../../../services/address/list'
import { fetchSettleDetail } from '../../../services/order/orderConfirm'
import { getNotes, handleInvoice } from './helpers'
import { commitPay, wechatPayOrder } from './pay'

interface GoodsSpecInfo {
  specValue?: string
  specValues?: string
}

interface GoodsRequestItem {
  quantity: number
  storeId: string
  storeName: string
  uid?: string
  saasId?: string
  spuId: string
  goodsName?: string
  title?: string
  skuId: string
  roomId?: string
  primaryImage?: string
  image?: string
  price?: string | number
  originPrice?: string | number
  specInfo?: GoodsSpecInfo[]
}

interface OrderCouponItem {
  couponId?: number | string
  promotionId?: number | string
  storeId: string
  status?: string
  type?: number
  value?: number
}

interface StoreCouponSelection {
  storeId: string
  couponList: OrderCouponItem[]
}

interface SettleSkuItem {
  reminderStock?: number
  quantity: number
  storeId: string
  uid?: string
  saasId?: string
  spuId: string
  goodsName: string
  skuId: string
  storeName?: string
  roomId?: string
  image?: string
  tagPrice?: string | number | null
  settlePrice?: string | number | null
  tagText?: string | null
  skuSpecLst?: GoodsSpecInfo[]
}

interface SettleStoreGoodsItem {
  storeId: string
  storeName: string
  remark?: string | null
  storeTotalPayAmount: string
  skuDetailVos?: SettleSkuItem[]
  couponList?: OrderCouponItem[]
}

interface OutOfStockGoodsItem {
  storeName: string
  unSettlementGoods: SettleSkuItem[]
}

type CheckoutAddress = (Address | DeliveryAddress) & { checked?: boolean }

interface SettleDetailData extends Omit<SettleDetailResult['data'], 'storeGoodsList' | 'outOfStockGoodsList' | 'abnormalDeliveryGoodsList' | 'inValidGoodsList' | 'limitGoodsList' | 'couponList' | 'userAddress'> {
  storeGoodsList: SettleStoreGoodsItem[]
  outOfStockGoodsList: OutOfStockGoodsItem[]
  abnormalDeliveryGoodsList: SettleSkuItem[]
  inValidGoodsList: SettleSkuItem[]
  limitGoodsList: SettleSkuItem[]
  couponList: OrderCouponItem[]
  userAddress: CheckoutAddress | null
}

interface OrderCardGoodsItem {
  id: number | string
  thumb: string
  title: string
  specs: string[]
  price: string | number
  settlePrice?: string | number | null
  titlePrefixTags: Array<{ text: string }>
  num: number
  skuId: string
  spuId: string
  storeId: string
}

interface OrderCardItem {
  id: string
  storeName: string
  status: number
  statusDesc: string
  amount: string | number
  goodsList: OrderCardGoodsItem[]
}

interface PageOptions {
  type?: string
  goodsRequestList?: string | GoodsRequestItem[]
  userAddressReq?: CheckoutAddress | null
}

interface NoteEvent {
  currentTarget?: {
    dataset?: {
      storenoteindex?: number | string
    }
  }
}

interface CouponEvent {
  detail?: {
    selectedList?: OrderCouponItem[]
  }
}

interface OpenCouponEvent {
  currentTarget?: {
    dataset?: {
      storeid?: string
    }
  }
}

const emptySettleDetailData: SettleDetailData = {
  settleType: 0,
  userAddress: null,
  totalGoodsCount: 0,
  packageCount: 0,
  totalAmount: '0',
  totalPayAmount: '0',
  totalDiscountAmount: '0',
  totalPromotionAmount: '0',
  totalCouponAmount: '0',
  totalSalePrice: '0',
  totalGoodsAmount: '0',
  totalDeliveryFee: '0',
  invoiceRequest: null,
  skuImages: null,
  deliveryFeeList: null,
  storeGoodsList: [],
  inValidGoodsList: [],
  outOfStockGoodsList: [],
  limitGoodsList: [],
  abnormalDeliveryGoodsList: [],
  invoiceSupport: 0,
  couponList: [],
}

const loading = ref(false)
const settleDetailData = ref<SettleDetailData>({ ...emptySettleDetailData })
const orderCardList = ref<OrderCardItem[]>([])
const couponsShow = ref(false)
const invoiceData = ref<InvoiceData>({
  email: '',
  buyerTaxNo: '',
  invoiceType: null,
  buyerPhone: '',
  buyerName: '',
  titleType: '',
  contentType: '',
})
const goodsRequestList = ref<GoodsRequestItem[]>([])
const userAddressReq = ref<CheckoutAddress | null>(null)
const popupShow = ref(false)
const storeInfoList = ref<StoreInfoItem[]>([])
const storeNoteIndex = ref(0)
const promotionGoodsList = ref<OrderCardGoodsItem[]>([])
const couponList = ref<OrderCouponItem[]>([])
const submitCouponList = ref<StoreCouponSelection[]>([])
const currentStoreId = ref<string>('')
const userAddress = ref<CheckoutAddress | null>(null)
const dialogShow = ref(false)
const noteInfo = ref<string[]>([])
const tempNoteInfo = ref<string[]>([])
const firstStoreId = computed(() => settleDetailData.value.storeGoodsList[0]?.storeId || '')
const currentStoreRemark = computed(() => storeInfoList.value[storeNoteIndex.value]?.remark || '')

let payLock = false

function parseGoodsRequestList(rawValue: unknown): GoodsRequestItem[] {
  if (Array.isArray(rawValue)) {
    return rawValue as GoodsRequestItem[]
  }
  if (typeof rawValue === 'string') {
    try {
      const parsedValue = JSON.parse(rawValue)
      return Array.isArray(parsedValue) ? parsedValue as GoodsRequestItem[] : []
    }
    catch {
      return []
    }
  }
  return []
}

function normalizeAddress(address?: SelectableAddress): CheckoutAddress | null {
  return address
    ? {
        ...address,
        checked: true,
      }
    : null
}

async function init() {
  loading.value = true
  await handleOptionsParams({
    goodsRequestList: goodsRequestList.value,
  })
}

async function handleOptionsParams(options: PageOptions = {}, selectedCouponList?: OrderCouponItem[]) {
  let nextGoodsRequestList = goodsRequestList.value
  let nextUserAddressReq = userAddressReq.value
  const nextStoreInfoList: StoreInfoItem[] = []

  if (options.userAddressReq) {
    nextUserAddressReq = options.userAddressReq
  }

  if (options.type === 'cart') {
    nextGoodsRequestList = parseGoodsRequestList(wpi.getStorageSync('order.goodsRequestList'))
  }
  else if (typeof options.goodsRequestList !== 'undefined') {
    nextGoodsRequestList = parseGoodsRequestList(options.goodsRequestList)
  }

  const storeMap: Record<string, boolean> = {}
  nextGoodsRequestList.forEach((goods) => {
    if (!storeMap[goods.storeId]) {
      nextStoreInfoList.push({
        storeId: goods.storeId,
        storeName: goods.storeName,
      })
      storeMap[goods.storeId] = true
    }
  })

  goodsRequestList.value = nextGoodsRequestList
  userAddressReq.value = nextUserAddressReq
  storeInfoList.value = nextStoreInfoList

  try {
    const res = await fetchSettleDetail({
      goodsRequestList: nextGoodsRequestList,
      userAddressReq: nextUserAddressReq ?? undefined,
      couponList: selectedCouponList,
    })
    loading.value = false
    initData(res.data as SettleDetailData)
  }
  catch {
    handleError()
  }
}

function initData(resData: SettleDetailData) {
  const data = handleResToGoodsCard(resData)
  userAddressReq.value = resData.userAddress
  userAddress.value = resData.userAddress
  settleDetailData.value = data
  isInvalidOrder(data)
}

function isInvalidOrder(data: SettleDetailData) {
  const hasInvalidGoods
    = data.limitGoodsList.length > 0
      || data.abnormalDeliveryGoodsList.length > 0
      || data.inValidGoodsList.length > 0
  popupShow.value = hasInvalidGoods
  return hasInvalidGoods || data.settleType === 0
}

function handleError() {
  showToast({
    message: '结算异常, 请稍后重试',
    duration: 2000,
    icon: '',
  })
  loading.value = false
  setTimeout(() => {
    void wpi.navigateBack()
  }, 1500)
}

function handleGoodsRequest(goods: SettleSkuItem, isOutStock = false): GoodsRequestItem {
  return {
    quantity: isOutStock ? goods.reminderStock ?? goods.quantity : goods.quantity,
    storeId: goods.storeId,
    uid: goods.uid,
    saasId: goods.saasId,
    spuId: goods.spuId,
    goodsName: goods.goodsName,
    skuId: goods.skuId,
    storeName: goods.storeName || '',
    roomId: goods.roomId,
  }
}

function getRequestGoodsList(storeGoodsList: SettleStoreGoodsItem[]): GoodsRequestItem[] {
  const filterStoreGoodsList: GoodsRequestItem[] = []
  storeGoodsList.forEach((store) => {
    const currentStoreName = store.storeName
    ;(store.skuDetailVos || []).forEach((goods) => {
      filterStoreGoodsList.push(handleGoodsRequest({
        ...goods,
        storeName: currentStoreName,
      }))
    })
  })
  return filterStoreGoodsList
}

function handleResToGoodsCard(data: SettleDetailData) {
  const nextOrderCardList: OrderCardItem[] = []
  const nextStoreInfoList: StoreInfoItem[] = []
  const nextSubmitCouponList: StoreCouponSelection[] = []

  noteInfo.value = []
  tempNoteInfo.value = []

  data.storeGoodsList.forEach((store) => {
    const goodsList: OrderCardGoodsItem[] = (store.skuDetailVos || []).map((item, index) => ({
      id: index,
      thumb: item.image || '',
      title: item.goodsName,
      specs: Array.isArray(item.skuSpecLst)
        ? item.skuSpecLst.map(spec => spec?.specValue || spec?.specValues || '').filter(Boolean)
        : [],
      price: item.tagPrice || item.settlePrice || '0',
      settlePrice: item.settlePrice,
      titlePrefixTags: item.tagText ? [{ text: item.tagText }] : [],
      num: item.quantity,
      skuId: item.skuId,
      spuId: item.spuId,
      storeId: item.storeId,
    }))

    nextOrderCardList.push({
      id: store.storeId,
      storeName: store.storeName,
      status: 0,
      statusDesc: '',
      amount: store.storeTotalPayAmount,
      goodsList,
    })
    nextStoreInfoList.push({
      storeId: store.storeId,
      storeName: store.storeName,
      remark: store.remark || '',
    })
    nextSubmitCouponList.push({
      storeId: store.storeId,
      couponList: store.couponList || [],
    })
    noteInfo.value.push(store.remark || '')
    tempNoteInfo.value.push(store.remark || '')
  })

  orderCardList.value = nextOrderCardList
  storeInfoList.value = nextStoreInfoList
  submitCouponList.value = nextSubmitCouponList

  const nextCurrentStoreId = currentStoreId.value || nextOrderCardList[0]?.id || ''
  currentStoreId.value = nextCurrentStoreId
  promotionGoodsList.value = nextOrderCardList.find(item => item.id === nextCurrentStoreId)?.goodsList || []
  couponList.value = nextSubmitCouponList.find(item => item.storeId === nextCurrentStoreId)?.couponList || []

  return data
}

function getOrderGoodsList(storeIndex: number) {
  return orderCardList.value[storeIndex]?.goodsList || []
}

async function onGotoAddress() {
  void getAddressPromise()
    .then((address) => {
      const nextAddress = normalizeAddress(address)
      if (nextAddress) {
        void handleOptionsParams({
          userAddressReq: nextAddress,
        })
      }
    })
    .catch(() => {})

  const id = userAddressReq.value?.id ? `&id=${userAddressReq.value.id}` : ''
  await wpi.navigateTo({
    url: `/pages/user/address/list/index?selectMode=1&isOrderSure=1${id}`,
  })
}

function onNotes(e: NoteEvent) {
  storeNoteIndex.value = Number(e.currentTarget?.dataset?.storenoteindex ?? 0)
  dialogShow.value = true
}

function onInput(e: { detail?: { value?: string } }) {
  noteInfo.value[storeNoteIndex.value] = e.detail?.value || ''
}

function onBlur() {}

function onFocus() {}

function onNoteConfirm() {
  tempNoteInfo.value[storeNoteIndex.value] = noteInfo.value[storeNoteIndex.value] || ''
  const nextStoreInfoList = storeInfoList.value.map((item, index) => index === storeNoteIndex.value
    ? {
        ...item,
        remark: noteInfo.value[index] || '',
      }
    : item)
  storeInfoList.value = nextStoreInfoList
  dialogShow.value = false
}

function onNoteCancel() {
  noteInfo.value[storeNoteIndex.value] = tempNoteInfo.value[storeNoteIndex.value] || ''
  dialogShow.value = false
}

async function onSureCommit() {
  const { outOfStockGoodsList, storeGoodsList, inValidGoodsList } = settleDetailData.value
  if (outOfStockGoodsList.length === 0 && inValidGoodsList.length === 0) {
    return
  }

  const filterOutGoodsList: GoodsRequestItem[] = []
  outOfStockGoodsList.forEach((outOfStockGoods) => {
    outOfStockGoods.unSettlementGoods.forEach((goods) => {
      filterOutGoodsList.push(handleGoodsRequest({
        ...goods,
        quantity: goods.reminderStock ?? goods.quantity,
        storeName: outOfStockGoods.storeName,
      }, true))
    })
  })

  await handleOptionsParams({
    goodsRequestList: filterOutGoodsList.concat(getRequestGoodsList(storeGoodsList)),
  })
}

function handlePay(data: {
  channel: string
  payInfo: string
  tradeNo: string
  interactId: string
  transactionId: string
}, currentSettleDetailData: SettleDetailData) {
  if (data.channel !== 'wechat') {
    return
  }

  void wechatPayOrder({
    payInfo: data.payInfo,
    orderId: data.tradeNo,
    orderAmt: currentSettleDetailData.totalAmount,
    payAmt: currentSettleDetailData.totalPayAmount,
    interactId: data.interactId,
    tradeNo: data.tradeNo,
    transactionId: data.transactionId,
  })
}

function handleCouponList(storeCouponList?: StoreCouponSelection[]) {
  if (!storeCouponList) {
    return []
  }
  return storeCouponList.flatMap(item => item.couponList)
}

async function submitOrder() {
  const currentAddress = settleDetailData.value.userAddress || userAddressReq.value
  if (!currentAddress) {
    showToast({
      message: '请添加收货地址',
      duration: 2000,
      icon: 'help-circle',
    })
    return
  }

  if (payLock || !settleDetailData.value.settleType || !settleDetailData.value.totalAmount) {
    return
  }

  payLock = true

  try {
    const resSubmitCouponList = handleCouponList(submitCouponList.value)
    const res = await commitPay({
      userAddressReq: currentAddress,
      goodsRequestList: goodsRequestList.value,
      userName: currentAddress.name,
      totalAmount: settleDetailData.value.totalPayAmount,
      invoiceRequest: invoiceData.value?.email ? invoiceData.value : null,
      storeInfoList: storeInfoList.value,
      couponList: resSubmitCouponList,
    })
    payLock = false

    if (isInvalidOrder(res.data as unknown as SettleDetailData)) {
      return
    }
    if (res.code === 'Success') {
      handlePay(res.data, settleDetailData.value)
      return
    }

    showToast({
      message: res.msg || '提交订单超时，请稍后重试',
      duration: 2000,
      icon: '',
    })
    setTimeout(() => {
      void wpi.navigateBack()
    }, 2000)
  }
  catch (error) {
    payLock = false
    const err = error as { code?: string, msg?: string }
    if (err.code === 'CONTAINS_INSUFFICIENT_GOODS' || err.code === 'TOTAL_AMOUNT_DIFFERENT') {
      showToast({
        message: err.msg || '支付异常',
        duration: 2000,
        icon: '',
      })
      await init()
      return
    }
    if (err.code === 'ORDER_PAY_FAIL') {
      showToast({
        message: '支付失败',
        duration: 2000,
        icon: 'close-circle',
      })
      setTimeout(() => {
        void wpi.redirectTo({
          url: '/pages/order/order-list/index',
        })
      })
      return
    }
    if (err.code === 'ILLEGAL_CONFIG_PARAM') {
      showToast({
        message: '支付失败，微信支付商户号设置有误，请商家重新检查支付设置。',
        duration: 2000,
        icon: 'close-circle',
      })
      setTimeout(() => {
        void wpi.redirectTo({
          url: '/pages/order/order-list/index',
        })
      })
      return
    }

    showToast({
      message: err.msg || '提交支付超时，请稍后重试',
      duration: 2000,
      icon: '',
    })
    setTimeout(() => {
      void wpi.navigateBack()
    }, 2000)
  }
}

async function onReceipt() {
  await wpi.navigateTo({
    url: `/pages/order/receipt/index?invoiceData=${JSON.stringify(invoiceData.value || {})}`,
  })
}

async function onCoupons(e: CouponEvent) {
  const selectedList = e.detail?.selectedList || []
  const nextSubmitCouponList = submitCouponList.value.map((storeCoupon) => {
    return {
      storeId: storeCoupon.storeId,
      couponList: storeCoupon.storeId === currentStoreId.value ? selectedList : storeCoupon.couponList,
    }
  })
  submitCouponList.value = nextSubmitCouponList
  couponsShow.value = false
  couponList.value = selectedList
  await handleOptionsParams({
    goodsRequestList: goodsRequestList.value,
  }, handleCouponList(nextSubmitCouponList))
}

function onOpenCoupons(e: OpenCouponEvent) {
  currentStoreId.value = e.currentTarget?.dataset?.storeid || ''
  promotionGoodsList.value = orderCardList.value.find(item => item.id === currentStoreId.value)?.goodsList || []
  couponList.value = submitCouponList.value.find(item => item.storeId === currentStoreId.value)?.couponList || []
  couponsShow.value = true
}

function onPopupChange() {
  popupShow.value = !popupShow.value
}

onLoad((options: PageOptions = {}) => {
  loading.value = true
  void handleOptionsParams(options)
})

onShow(() => {
  const nextInvoiceData = wpi.getStorageSync('invoiceData') as InvoiceData | undefined
  if (!nextInvoiceData) {
    return
  }
  invoiceData.value = nextInvoiceData
  wpi.removeStorageSync('invoiceData')
})

definePageJson({
  navigationBarTitleText: '订单确认',
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-textarea': 'tdesign-miniprogram/textarea/textarea',
    'price': '/components/price/index',
    'select-coupons': '../components/selectCoupons/selectCoupons',
    'no-goods': '../components/noGoods/noGoods',
    't-image': '/components/webp-image/index',
    'address-card': './components/address-card/index',
  },
})
</script>

<template>
  <view v-if="!loading" class="order-sure [box-sizing:border-box] [background:#f6f6f6] [padding:24rpx_0_calc(env(safe-area-inset-bottom)_+_136rpx)] [min-height:100vh] [&_.wx-pay-cover]:[position:fixed] [&_.wx-pay-cover]:[left:0] [&_.wx-pay-cover]:[bottom:0] [&_.wx-pay-cover]:[right:0] [&_.wx-pay-cover]:[z-index:10] [&_.wx-pay-cover]:[background:#fff] [&_.wx-pay-cover]:[height:112rpx] [&_.wx-pay-cover]:[padding-bottom:env(safe-area-inset-bottom)] [&_.wx-pay-cover_.wx-pay]:[width:100%] [&_.wx-pay-cover_.wx-pay]:[height:100rpx] [&_.wx-pay-cover_.wx-pay]:[box-sizing:border-box] [&_.wx-pay-cover_.wx-pay]:[padding:0rpx_32rpx] [&_.wx-pay-cover_.wx-pay]:[display:flex] [&_.wx-pay-cover_.wx-pay]:[justify-content:space-between] [&_.wx-pay-cover_.wx-pay]:[align-items:center] [&_.wx-pay-cover_.wx-pay_.price]:[color:#fa4126] [&_.wx-pay-cover_.wx-pay_.price]:[font-weight:bold] [&_.wx-pay-cover_.wx-pay_.price]:[font-size:63rpx] [&_.wx-pay-cover_.wx-pay_.price]:[line-height:88rpx] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[height:80rpx] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[width:240rpx] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[border-radius:40rpx] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[background-color:#fa4126] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[color:#ffffff] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[line-height:80rpx] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[font-weight:bold] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[font-size:28rpx] [&_.wx-pay-cover_.wx-pay_.submit-btn]:[text-align:center] [&_.wx-pay-cover_.wx-pay_.btn-gray]:[background:#cccccc] [&_.pay-detail]:[background-color:#ffffff] [&_.pay-detail]:[padding:16rpx_32rpx] [&_.pay-detail]:[width:100%] [&_.pay-detail]:[box-sizing:border-box] [&_.pay-detail_.pay-item]:[width:100%] [&_.pay-detail_.pay-item]:[height:72rpx] [&_.pay-detail_.pay-item]:[display:flex] [&_.pay-detail_.pay-item]:[align-items:center] [&_.pay-detail_.pay-item]:[justify-content:space-between] [&_.pay-detail_.pay-item]:[font-size:26rpx] [&_.pay-detail_.pay-item]:[line-height:36rpx] [&_.pay-detail_.pay-item]:[color:#666666] [&_.pay-detail_.pay-item_.pay-item__right]:[color:#333333] [&_.pay-detail_.pay-item_.pay-item__right]:[font-size:24rpx] [&_.pay-detail_.pay-item_.pay-item__right]:[display:flex] [&_.pay-detail_.pay-item_.pay-item__right]:[align-items:center] [&_.pay-detail_.pay-item_.pay-item__right]:[justify-content:flex-end] [&_.pay-detail_.pay-item_.pay-item__right]:[max-width:400rpx] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[display:-webkit-box] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[-webkit-box-orient:vertical] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[-webkit-line-clamp:2] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[max-width:400rpx] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[text-overflow:ellipsis] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[overflow:hidden] [&_.pay-detail_.pay-item_.font-bold]:[font-weight:bold] [&_.pay-detail_.pay-item_.primary]:[color:#fa4126] [&_.add-notes_.dialog__message]:[border-radius:8rpx] [&_.amount-wrapper]:[width:100%] [&_.amount-wrapper]:[box-sizing:border-box] [&_.amount-wrapper]:[background-color:#ffffff] [&_.amount-wrapper]:[padding:0rpx_32rpx] [&_.amount-wrapper]:[height:96rpx] [&_.pay-amount]:[width:100%] [&_.pay-amount]:[height:96rpx] [&_.pay-amount]:[display:flex] [&_.pay-amount]:[align-items:center] [&_.pay-amount]:[justify-content:flex-end] [&_.pay-amount]:[font-size:28rpx] [&_.pay-amount]:[color:#333333] [&_.pay-amount]:[position:relative] [&_.pay-amount_.order-num]:[color:#999999] [&_.pay-amount_.order-num]:[padding-right:8rpx] [&_.pay-amount_.total-price]:[font-size:36rpx] [&_.pay-amount_.total-price]:[color:#fa4126] [&_.pay-amount_.total-price]:[font-weight:bold] [&_.pay-amount_.total-price]:[padding-left:8rpx]">
    <address-card :addressData="userAddress" @addclick="onGotoAddress" @addressclick="onGotoAddress" />
    <view
      v-for="(stores, storeIndex) in settleDetailData.storeGoodsList"
      :key="stores.storeId || storeIndex"
      class="order-wrapper [&_.store-wrapper]:[width:100%] [&_.store-wrapper]:[height:96rpx] [&_.store-wrapper]:[box-sizing:border-box] [&_.store-wrapper]:[padding:0_32rpx] [&_.store-wrapper]:[display:flex] [&_.store-wrapper]:[align-items:center] [&_.store-wrapper]:[font-size:28rpx] [&_.store-wrapper]:[line-height:40rpx] [&_.store-wrapper]:[color:#333333] [&_.store-wrapper]:[background-color:#ffffff] [&_.store-wrapper_.store-logo]:[margin-right:16rpx] [&_.goods-wrapper]:[width:100%] [&_.goods-wrapper]:[box-sizing:border-box] [&_.goods-wrapper]:[padding:16rpx_32rpx] [&_.goods-wrapper]:[display:flex] [&_.goods-wrapper]:[align-items:flex-start] [&_.goods-wrapper]:[justify-content:space-between] [&_.goods-wrapper]:[font-size:24rpx] [&_.goods-wrapper]:[line-height:32rpx] [&_.goods-wrapper]:[color:#999999] [&_.goods-wrapper]:[background-color:#ffffff]"
    >
      <view class="store-wrapper">
        <t-icon prefix="wr" size="40rpx" color="#333333" name="store" class="store-logo" />
        {{ stores.storeName }}
      </view>
      <view
        v-for="(goods, gIndex) in getOrderGoodsList(storeIndex)"
        v-if="getOrderGoodsList(storeIndex).length > 0"
        :key="goods.id || gIndex"
        class="goods-wrapper [&_.goods-image]:[width:176rpx] [&_.goods-image]:[height:176rpx] [&_.goods-image]:[border-radius:8rpx] [&_.goods-image]:[overflow:hidden] [&_.goods-image]:[margin-right:16rpx] [&_.goods-content]:[flex:1] [&_.goods-content_.goods-title]:[display:-webkit-box] [&_.goods-content_.goods-title]:[-webkit-box-orient:vertical] [&_.goods-content_.goods-title]:[-webkit-line-clamp:2] [&_.goods-content_.goods-title]:[overflow:hidden] [&_.goods-content_.goods-title]:[text-overflow:ellipsis] [&_.goods-content_.goods-title]:[font-size:28rpx] [&_.goods-content_.goods-title]:[line-height:40rpx] [&_.goods-content_.goods-title]:[margin-bottom:12rpx] [&_.goods-content_.goods-title]:[color:#333333] [&_.goods-content_.goods-title]:[margin-right:16rpx] [&_.goods-right]:[min-width:128rpx] [&_.goods-right]:[display:flex] [&_.goods-right]:[flex-direction:column] [&_.goods-right]:[align-items:flex-end]"
      >
        <t-image :src="goods.thumb" t-class="goods-image" mode="aspectFill" />
        <view class="goods-content">
          <view class="goods-title">
            {{ goods.title }}
          </view>
          <view>{{ goods.specs }}</view>
        </view>
        <view class="goods-right [&_.goods-price]:[color:#333333] [&_.goods-price]:[font-size:32rpx] [&_.goods-price]:[line-height:48rpx] [&_.goods-price]:[font-weight:bold] [&_.goods-price]:[margin-bottom:16rpx] [&_.goods-num]:[text-align:right]">
          <price wr-class="goods-price" :price="goods.price" :fill="true" decimalSmaller />
          <view class="goods-num">
            x{{ goods.num }}
          </view>
        </view>
      </view>
    </view>
    <view class="pay-detail">
      <view class="pay-item">
        <text>商品总额</text>
        <price
          fill
          decimalSmaller
          wr-class="pay-item__right font-bold"
          :price="settleDetailData.totalSalePrice || '0'"
        />
      </view>
      <view class="pay-item">
        <text>运费</text>
        <view class="pay-item__right font-bold">
          <block v-if="settleDetailData.totalDeliveryFee && settleDetailData.totalDeliveryFee != 0">
            +
            <price fill decimalSmaller :price="settleDetailData.totalDeliveryFee" />
          </block>
          <text v-else>
            免运费
          </text>
        </view>
      </view>
      <view class="pay-item">
        <text>活动优惠</text>
        <view class="pay-item__right primary font-bold">
          -
          <price fill :price="settleDetailData.totalPromotionAmount || 0" />
        </view>
      </view>
      <view class="pay-item">
        <text>优惠券</text>
        <view
          class="pay-item__right"
          :data-storeid="firstStoreId"
          @tap.stop="onOpenCoupons"
        >
          <block v-if="submitCouponList.length">
            <block v-if="settleDetailData.totalCouponAmount && settleDetailData.totalCouponAmount !== '0'">
              -<price fill decimalSmaller :price="settleDetailData.totalCouponAmount" />
            </block>
            <block v-else>
              选择优惠券
            </block>
          </block>
          <text v-else>
            无可用
          </text>
          <t-icon name="chevron-right" size="32rpx" color="#BBBBBB" />
        </view>
      </view>
      <view v-if="settleDetailData.invoiceSupport" class="pay-item">
        <text>发票</text>
        <view class="pay-item__right" @tap.stop="onReceipt">
          <text>{{ handleInvoice(invoiceData) }}</text>
          <t-icon name="chevron-right" size="32rpx" color="#BBBBBB" />
        </view>
      </view>
      <view class="pay-item">
        <text>订单备注</text>
        <view class="pay-item__right" :data-storenoteindex="0" @tap.stop="onNotes">
          <text class="pay-remark">
            {{ getNotes(storeInfoList, 0) ? getNotes(storeInfoList, 0) : '选填，建议先和商家沟通确认' }}
          </text>
          <t-icon name="chevron-right" size="32rpx" color="#BBBBBB" />
        </view>
      </view>
    </view>
    <view class="amount-wrapper">
      <view class="pay-amount">
        <text class="order-num">
          共{{ settleDetailData.totalGoodsCount }}件
        </text>
        <text>小计</text>
        <price class="total-price" :price="settleDetailData.totalPayAmount" :fill="false" decimalSmaller />
      </view>
    </view>
    <view class="wx-pay-cover">
      <view class="wx-pay">
        <price decimalSmaller fill class="price" :price="settleDetailData.totalPayAmount || '0'" />
        <view :class="`submit-btn ${settleDetailData.settleType === 1 ? '' : 'btn-gray'}`" @tap="submitOrder">
          提交订单
        </view>
      </view>
    </view>
    <t-dialog
      t-class="add-notes [&_.t-textarea__placeholder]:[color:#aeb3b7] [&_.add-notes__textarea__font]:[font-size:26rpx] [&_.add-notes__textarea]:[margin-top:32rpx]"
      title="填写备注信息"
      :visible="dialogShow"
      confirm-btn="确认"
      cancel-btn="取消"
      t-class-content="add-notes__content"
      t-class-confirm="dialog__button-confirm"
      t-class-cancel="dialog__button-cancel"
      @confirm="onNoteConfirm"
      @cancel="onNoteCancel"
    >
      <template #content>
        <t-textarea

          :focus="dialogShow"
          class="notes"
          t-class="add-notes__textarea"
          :value="currentStoreRemark"
          placeholder="备注信息"
          t-class-textarea="add-notes__textarea__font"
          :maxlength="50"
          @focus="onFocus"
          @blur="onBlur"
          @change="onInput"
        />
      </template>
    </t-dialog>
    <t-popup :visible="popupShow" placement="bottom" @visible-change="onPopupChange">
      <template #content>
        <no-goods :settleDetailData="settleDetailData" @change="onSureCommit" />
      </template>
    </t-popup>
    <select-coupons
      :storeId="currentStoreId"
      :orderSureCouponList="couponList"
      :promotionGoodsList="promotionGoodsList"
      :couponsShow="couponsShow"
      @sure="onCoupons"
    />
  </view>
</template>
