<script setup lang="ts">
import type { RightsPreviewResponse } from '../../../model/order/applyService'
import type { DispatchApplyServicePayload } from '../../../services/order/applyService'
import { computed, onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'
import { alertDialog, confirmDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'
import {
  dispatchApplyService,

  dispatchConfirmReceived,
  fetchApplyReasonList,
  fetchRightsPreview,
} from '../../../services/order/applyService'
import { priceFormat } from '../../../utils/util'
import reasonSheet from '../components/reason-sheet/reasonSheet'
import { OrderStatus, ServiceReceiptStatus, ServiceType } from '../config'

interface QueryOptions {
  orderNo?: string
  skuId?: string
  spuId?: string
  canApplyReturn?: string
  orderStatus?: string
  logisticsNo?: string
}

interface ReceiptStatusItem {
  desc: string
  status: number | null
}

interface ApplyReasonItem {
  desc: string
  type: string | null
}

interface GoodsInfo {
  id: string
  thumb: string
  title: string
  spuId: string
  skuId: string
  specs: string[]
  paidAmountEach: number
  boughtQuantity: number
  price: number
}

interface UploadFileItem {
  [key: string]: unknown
}

interface ServiceAmountState {
  max: number
  current: number
  temp: string
  focus: boolean
}

interface ServiceFormState {
  returnNum: number
  receiptStatus: ReceiptStatusItem
  applyReason: ApplyReasonItem
  amount: ServiceAmountState
  remark: string
  rightsImageUrls: UploadFileItem[]
}

interface ValidateResult {
  valid: boolean
  msg: string
}

interface StepperChangeEvent {
  detail?: {
    value?: number | string
  }
}

interface InputChangeEvent {
  detail?: {
    value?: string
  }
}

interface DatasetIndexEvent {
  currentTarget?: {
    dataset?: {
      index?: number | string
    }
  }
}

interface UploadSuccessEvent {
  detail?: {
    files?: UploadFileItem[]
  }
}

interface UploadRemoveEvent {
  detail?: {
    index?: number
  }
}

type ServiceRequireType = 'REFUND_MONEY' | 'REFUND_GOODS' | ''

const AMOUNT_INPUT_RE = /\d+(\.?\d*)?/
const AMOUNT_BLUR_RE = /\d+(\.?\d+)?/

const defaultReceiptStatus: ReceiptStatusItem = {
  desc: '请选择',
  status: null,
}

const defaultApplyReason: ApplyReasonItem = {
  desc: '请选择',
  type: null,
}

const emptyGoodsInfo: GoodsInfo = {
  id: '',
  thumb: '',
  title: '',
  spuId: '',
  skuId: '',
  specs: [],
  paidAmountEach: 0,
  boughtQuantity: 0,
  price: 0,
}

const receiptStatusList: ReceiptStatusItem[] = [
  {
    desc: '未收到货',
    status: ServiceReceiptStatus.NOT_RECEIPTED,
  },
  {
    desc: '已收到货',
    status: ServiceReceiptStatus.RECEIPTED,
  },
]

const uploadGridConfig = {
  column: 3,
  width: 212,
  height: 212,
}

const query = ref<QueryOptions>({})
const uploading = ref(false)
const canApplyReturn = ref(true)
const goodsInfo = ref<GoodsInfo>({ ...emptyGoodsInfo })
const applyReasons = ref<ApplyReasonItem[]>([])
const serviceType = ref<number | null>(null)
const serviceRequireType = ref<ServiceRequireType>('')
const serviceFrom = ref<ServiceFormState>({
  returnNum: 1,
  receiptStatus: { ...defaultReceiptStatus },
  applyReason: { ...defaultApplyReason },
  amount: {
    max: 0,
    current: 0,
    temp: '0',
    focus: false,
  },
  remark: '',
  rightsImageUrls: [],
})
const maxApplyNum = ref(2)
const amountTip = ref('')
const showReceiptStatusDialog = ref(false)
const submitting = ref(false)
const inputDialogVisible = ref(false)

const validateRes = computed<ValidateResult>(() => {
  if (!serviceFrom.value.receiptStatus.status) {
    return {
      valid: false,
      msg: '请选择收货状态',
    }
  }
  if (!serviceFrom.value.applyReason.type) {
    return {
      valid: false,
      msg: '请填写退款原因',
    }
  }
  if (!serviceFrom.value.amount.current) {
    return {
      valid: false,
      msg: '请填写退款金额',
    }
  }
  if (serviceFrom.value.amount.current <= 0) {
    return {
      valid: false,
      msg: '退款金额必须大于0',
    }
  }
  return {
    valid: true,
    msg: '',
  }
})

const amountDialogClass = computed(() =>
  `${serviceFrom.value.amount.focus ? 'amount-dialog--focus' : ''} [&_.popup__content--center]:[top:100rpx] [&_.popup__content--center]:[transform:translate(-50%,_0)]`,
)

function parsePriceToFen(value: string | number | undefined) {
  if (typeof value === 'number') {
    return value
  }
  const parsed = Number.parseFloat(String(value ?? '0'))
  if (Number.isNaN(parsed)) {
    return 0
  }
  return Math.round(parsed)
}

function formatAmountValue(value: number) {
  return String(priceFormat(value) ?? '0')
}

function buildGoodsInfo(response: RightsPreviewResponse): GoodsInfo {
  const data = response.data
  return {
    id: data.skuId,
    thumb: data.goodsInfo?.skuImage ?? '',
    title: data.goodsInfo?.goodsName ?? '',
    spuId: data.spuId ?? query.value.spuId ?? '',
    skuId: data.skuId,
    specs: (data.goodsInfo?.specInfo ?? []).map(item => item.specValue),
    paidAmountEach: parsePriceToFen(data.paidAmountEach),
    boughtQuantity: data.boughtQuantity ?? 0,
    price: parsePriceToFen(data.paidAmountEach),
  }
}

async function checkQuery() {
  const { orderNo, skuId } = query.value
  if (!orderNo) {
    await alertDialog({
      content: '请先选择订单',
    })
    await wpi.redirectTo({
      url: '/pages/order/order-list/index',
    })
    return false
  }
  if (!skuId) {
    await alertDialog({
      content: '请先选择商品',
    })
    await wpi.redirectTo({
      url: `/pages/order/order-detail/index?orderNo=${orderNo}`,
    })
    return false
  }
  return true
}

async function getRightsPreview() {
  return fetchRightsPreview({
    orderNo: query.value.orderNo,
    skuId: query.value.skuId,
    spuId: query.value.spuId,
    numOfSku: serviceFrom.value.returnNum,
  })
}

async function refresh() {
  await wpi.showLoading({
    title: 'loading',
  })
  try {
    const response = await getRightsPreview()
    goodsInfo.value = buildGoodsInfo(response)
    const nextAmount: ServiceAmountState = {
      ...serviceFrom.value.amount,
      max: parsePriceToFen(response.data.refundableAmount),
      current: parsePriceToFen(response.data.refundableAmount),
      temp: formatAmountValue(parsePriceToFen(response.data.refundableAmount)),
      focus: false,
    }
    serviceFrom.value = {
      ...serviceFrom.value,
      amount: nextAmount,
      returnNum: response.data.numOfSku,
    }
    amountTip.value = `最多可申请退款¥ ${priceFormat(response.data.refundableAmount, 2)}，含发货运费¥ ${priceFormat(response.data.shippingFeeIncluded, 2)}`
    maxApplyNum.value = response.data.numOfSkuAvailable
  }
  finally {
    await wpi.hideLoading()
  }
}

async function getApplyReasons(receiptStatus: number | null) {
  if (!receiptStatus) {
    return []
  }
  const rightsReasonType
    = serviceRequireType.value === 'REFUND_MONEY' && receiptStatus === ServiceReceiptStatus.NOT_RECEIPTED
      ? 'REFUND_MONEY'
      : receiptStatus
  try {
    const response = await fetchApplyReasonList({
      rightsReasonType,
    })
    return response.data.rightsReasonList.map(reason => ({
      type: reason.id,
      desc: reason.desc,
    }))
  }
  catch {
    return []
  }
}

async function switchReceiptStatus(index: number) {
  const statusItem = receiptStatusList[index]
  showReceiptStatusDialog.value = false
  if (!statusItem) {
    serviceFrom.value = {
      ...serviceFrom.value,
      receiptStatus: { ...defaultReceiptStatus },
      applyReason: { ...defaultApplyReason },
    }
    applyReasons.value = []
    return
  }
  if (statusItem.status === serviceFrom.value.receiptStatus.status) {
    return
  }
  const reasons = await getApplyReasons(statusItem.status)
  serviceFrom.value = {
    ...serviceFrom.value,
    receiptStatus: statusItem,
    applyReason: { ...defaultApplyReason },
  }
  applyReasons.value = reasons
}

async function onApplyOnlyRefund() {
  await wpi.setNavigationBarTitle({
    title: '申请退款',
  })
  serviceRequireType.value = 'REFUND_MONEY'
  serviceType.value = ServiceType.ONLY_REFUND
  await switchReceiptStatus(0)
}

async function onApplyReturnGoods() {
  await wpi.setNavigationBarTitle({
    title: '申请退货退款',
  })
  const orderStatus = Number.parseInt(query.value.orderStatus ?? '0')
  if (orderStatus === OrderStatus.PENDING_RECEIPT) {
    try {
      await confirmDialog({
        title: '订单商品是否已经收到货',
        content: '',
        confirmBtn: '确认收货，并申请退货',
        cancelBtn: '未收到货',
      })
      await dispatchConfirmReceived({
        parameter: {
          logisticsNo: query.value.logisticsNo,
          orderNo: query.value.orderNo,
        },
      })
    }
    catch {
      return
    }
  }
  serviceRequireType.value = 'REFUND_GOODS'
  serviceType.value = ServiceType.RETURN_GOODS
  await switchReceiptStatus(1)
}

function onApplyGoodsStatus() {
  showReceiptStatusDialog.value = true
}

async function onApplyReturnGoodsStatus() {
  if (!applyReasons.value.length) {
    showToast({
      message: '请先选择收货状态',
      icon: '',
    })
    return
  }
  try {
    const indexes = await reasonSheet({
      show: true,
      title: '选择退款原因',
      options: applyReasons.value.map(reason => ({
        title: reason.desc,
        checked: reason.type === serviceFrom.value.applyReason.type,
      })),
      showConfirmButton: true,
      showCloseButton: true,
      emptyTip: '请选择退款原因',
    })
    const selected = applyReasons.value[indexes[0]]
    if (!selected) {
      return
    }
    serviceFrom.value = {
      ...serviceFrom.value,
      applyReason: selected,
    }
  }
  catch {}
}

function onChangeReturnNum(event: StepperChangeEvent) {
  const value = Number(event.detail?.value ?? 1)
  serviceFrom.value = {
    ...serviceFrom.value,
    returnNum: Number.isNaN(value) ? 1 : value,
  }
}

function onReceiptStatusDialogConfirm(event: DatasetIndexEvent) {
  const rawIndex = event.currentTarget?.dataset?.index
  if (typeof rawIndex === 'undefined') {
    showReceiptStatusDialog.value = false
    return
  }
  void switchReceiptStatus(Number(rawIndex))
}

function closeReceiptStatusDialog() {
  showReceiptStatusDialog.value = false
}

function onAmountTap() {
  const nextAmount: ServiceAmountState = {
    ...serviceFrom.value.amount,
    temp: formatAmountValue(serviceFrom.value.amount.current),
    focus: true,
  }
  serviceFrom.value = {
    ...serviceFrom.value,
    amount: nextAmount,
  }
  inputDialogVisible.value = true
}

function onAmountInput(event: InputChangeEvent) {
  const rawValue = event.detail?.value ?? ''
  const matched = rawValue.match(AMOUNT_INPUT_RE)
  const nextAmount: ServiceAmountState = {
    ...serviceFrom.value.amount,
    temp: matched ? matched[0] : '',
  }
  serviceFrom.value = {
    ...serviceFrom.value,
    amount: nextAmount,
  }
}

function onAmountBlur(event: InputChangeEvent) {
  const rawValue = event.detail?.value ?? ''
  const matched = rawValue.match(AMOUNT_BLUR_RE)
  let value = matched ? Number.parseFloat(matched[0]) * 100 : 0
  if (value > serviceFrom.value.amount.max) {
    value = serviceFrom.value.amount.max
  }
  const nextAmount: ServiceAmountState = {
    ...serviceFrom.value.amount,
    temp: formatAmountValue(value),
    focus: false,
  }
  serviceFrom.value = {
    ...serviceFrom.value,
    amount: nextAmount,
  }
}

function onAmountFocus() {
  const nextAmount: ServiceAmountState = {
    ...serviceFrom.value.amount,
    focus: true,
  }
  serviceFrom.value = {
    ...serviceFrom.value,
    amount: nextAmount,
  }
}

function onAmountDialogConfirm() {
  const normalized = Number.parseFloat(serviceFrom.value.amount.temp || '0')
  const current = Number.isNaN(normalized) ? 0 : Math.min(Math.round(normalized * 100), serviceFrom.value.amount.max)
  const nextAmount: ServiceAmountState = {
    ...serviceFrom.value.amount,
    current,
    temp: formatAmountValue(current),
    focus: false,
  }
  serviceFrom.value = {
    ...serviceFrom.value,
    amount: nextAmount,
  }
  inputDialogVisible.value = false
}

function onAmountDialogCancel() {
  const nextAmount: ServiceAmountState = {
    ...serviceFrom.value.amount,
    temp: formatAmountValue(serviceFrom.value.amount.current),
    focus: false,
  }
  serviceFrom.value = {
    ...serviceFrom.value,
    amount: nextAmount,
  }
  inputDialogVisible.value = false
}

function onRemarkChange(event: InputChangeEvent) {
  serviceFrom.value = {
    ...serviceFrom.value,
    remark: event.detail?.value ?? '',
  }
}

async function submitCheck() {
  const result = validateRes.value
  if (!result.valid) {
    showToast({
      message: result.msg,
      icon: '',
    })
    return false
  }
  if (!serviceType.value) {
    showToast({
      message: '请选择售后类型',
      icon: '',
    })
    return false
  }
  return true
}

async function onSubmit() {
  const passed = await submitCheck()
  if (!passed || !serviceType.value) {
    return
  }
  const params: DispatchApplyServicePayload = {
    rights: {
      orderNo: query.value.orderNo,
      refundRequestAmount: serviceFrom.value.amount.current,
      rightsImageUrls: serviceFrom.value.rightsImageUrls,
      rightsReasonDesc: serviceFrom.value.applyReason.desc,
      rightsReasonType: serviceFrom.value.applyReason.type,
      rightsType: serviceType.value,
    },
    rightsItem: [
      {
        itemTotalAmount: goodsInfo.value.price * serviceFrom.value.returnNum,
        rightsQuantity: serviceFrom.value.returnNum,
        skuId: query.value.skuId,
        spuId: query.value.spuId,
      },
    ],
    refundMemo: serviceFrom.value.remark,
  }

  submitting.value = true
  try {
    const response = await dispatchApplyService(params)
    showToast({
      message: '申请成功',
      icon: '',
    })
    await wpi.redirectTo({
      url: `/pages/order/after-service-detail/index?rightsNo=${response.data.rightsNo}`,
    })
  }
  finally {
    submitting.value = false
  }
}

function handleSuccess(event: UploadSuccessEvent) {
  serviceFrom.value = {
    ...serviceFrom.value,
    rightsImageUrls: event.detail?.files ?? [],
  }
}

function handleRemove(event: UploadRemoveEvent) {
  const index = event.detail?.index ?? -1
  if (index < 0) {
    return
  }
  const rightsImageUrls = [...serviceFrom.value.rightsImageUrls]
  rightsImageUrls.splice(index, 1)
  serviceFrom.value = {
    ...serviceFrom.value,
    rightsImageUrls,
  }
}

function handleComplete() {
  uploading.value = false
}

function handleSelectChange() {
  uploading.value = true
}

onLoad((options: QueryOptions = {}) => {
  query.value = options
  canApplyReturn.value = options.canApplyReturn === 'true'
  void (async () => {
    const valid = await checkQuery()
    if (!valid) {
      return
    }
    await refresh()
  })()
})

definePageJson({
  navigationBarTitleText: '选择售后类型',
  usingComponents: {
    'wr-price': '/components/price/index',
    'wr-order-goods-card': '../components/order-goods-card/index',
    'wr-reason-sheet': '../components/reason-sheet/index',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-button': 'tdesign-miniprogram/button/button',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-stepper': 'tdesign-miniprogram/stepper/stepper',
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-textarea': 'tdesign-miniprogram/textarea/textarea',
    't-input': 'tdesign-miniprogram/input/input',
    't-upload': 'tdesign-miniprogram/upload/upload',
  },
})
</script>

<template>
  <view class="select-service [&_.service-form_.service-from-group]:mt-[20rpx] [&_.service-form]:pb-[calc(env(safe-area-inset-bottom)+80rpx)] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:text-[36rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:text-[#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:font-[DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:text-[28rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:text-[#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:font-[DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:text-[#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:text-[24rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:font-[DIN_Alternate] [&_.remark]:min-h-[110rpx] [&_.remark]:rounded-[10rpx] [&_.remark]:mt-[20rpx] [&_.remark]:bg-[#f5f5f5] [&_.special-cell_.special-cell-note]:flex [&_.special-cell_.special-cell-note]:flex-col [&_.special-cell_.wr-cell__title]:mr-[100rpx] [&_.special-cell_.special-cell-note-price-class]:text-[36rpx] [&_.special-cell_.special-cell-note-price-class]:text-[#fa4126] [&_.special-cell_.special-cell-note-price-class]:font-[DIN_Alternate] [&_.special-cell_.special-cell-note-price-decimal]:text-[28rpx] [&_.special-cell_.special-cell-note-price-decimal]:text-[#fa4126] [&_.special-cell_.special-cell-note-price-decimal]:font-[DIN_Alternate] [&_.special-cell_.special-cell-note-price-symbol]:text-[#fa4126] [&_.special-cell_.special-cell-note-price-symbol]:text-[24rpx] [&_.special-cell_.special-cell-note-price-symbol]:font-[DIN_Alternate] [&_.bottom-bar__btn]:w-[686rpx] [&_.bottom-bar__btn]:bg-[#fa4126] [&_.bottom-bar__btn]:text-white [&_.bottom-bar__btn]:text-[32rpx] [&_.bottom-bar__btn]:rounded-[48rpx] [&_.bottom-bar__btn]:absolute [&_.bottom-bar__btn]:left-[50%] [&_.bottom-bar__btn]:top-[20rpx] [&_.bottom-bar__btn]:transform-[translateX(-50%)] [&_.bottom-bar__btn_.disabled]:bg-[#c6c6c6] [&_.order-goods-card_.wr-goods-card]:p-[0_30rpx] [&_.bottom-bar]:bg-white [&_.bottom-bar]:fixed [&_.bottom-bar]:bottom-0 [&_.bottom-bar]:left-0 [&_.bottom-bar]:w-full [&_.bottom-bar]:h-[158rpx] [&_.bottom-bar]:z-3">
    <view class="order-goods-card [background:#fff] mb-[24rpx]">
      <wr-order-goods-card :goods="goodsInfo" no-top-line thumb-class="order-goods-card-title-class ![width:10rpx]">
        <template #footer>
          <view class="order-goods-card-footer flex w-[calc(100%-190rpx)] justify-between absolute left-[190rpx] bottom-[20rpx]">
            <wr-price
              :price="goodsInfo.paidAmountEach"
              fill
              wr-class="order-goods-card-footer-price-class"
              symbol-class="order-goods-card-footer-price-symbol"
              decimal-class="order-goods-card-footer-price-decimal"
            />
            <view class="order-goods-card-footer-num text-[#999] leading-[40rpx]">
              x {{ goodsInfo.boughtQuantity }}
            </view>
          </view>
        </template>
      </wr-order-goods-card>
    </view>
    <view v-if="!serviceRequireType" class="service-choice [&_.t-cell__title-text]:text-[#333] [&_.t-cell__title-text]:[font-weight:bold]">
      <t-cell-group>
        <t-cell
          title="申请退款（无需退货）"
          arrow
          description="没收到货，或与商家协商同意不用退货只退款"
          @tap="onApplyOnlyRefund"
        >
          <template #left-icon>
            <t-icon
              prefix="wr"
              class="t-cell__left__icon relative top-[-24rpx] mr-[18rpx]"
              name="goods_refund"
              size="48rpx"
              color="#fa4126"
            />
          </template>
        </t-cell>
        <t-cell
          v-if="canApplyReturn"
          title="退货退款"
          description="已收到货，需要退还收到的商品"
          arrow
          @tap="onApplyReturnGoods"
        >
          <template #left-icon>
            <t-icon
              prefix="wr"
              class="t-cell__left__icon relative top-[-24rpx] mr-[18rpx]"
              name="goods_return"
              size="48rpx"
              color="#fa4126"
            />
          </template>
        </t-cell>
        <t-cell v-else class="non-returnable" title="退货退款" description="该商品不支持退货">
          <template #left-icon>
            <t-icon
              prefix="wr"
              class="t-cell__left__icon relative top-[-24rpx] mr-[18rpx]"
              name="goods_return"
              size="48rpx"
              color="#fa4126"
            />
          </template>
        </t-cell>
      </t-cell-group>
    </view>
    <view v-else class="service-form [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-class]:text-[36rpx] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-class]:font-[DIN_Alternate] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-decimal]:text-[28rpx] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-decimal]:font-[DIN_Alternate] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-symbol]:text-[24rpx] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-symbol]:font-[DIN_Alternate]">
      <view class="service-from-group">
        <t-cell-group>
          <t-cell title="商品收货状态" arrow :note="serviceFrom.receiptStatus.desc" @tap="onApplyGoodsStatus" />
          <t-cell
            v-if="canApplyReturn"
            :bordered="false"
            title="退款原因"
            :note="serviceFrom.applyReason.desc"
            arrow
            @tap="onApplyReturnGoodsStatus"
          />
        </t-cell-group>
      </view>
      <view class="service-from-group">
        <t-cell-group>
          <t-cell title="退款商品数量">
            <template #note>
              <t-stepper
                theme="filled"
                min="1"
                :max="maxApplyNum"
                :value="serviceFrom.returnNum"
                @change="onChangeReturnNum"
              />
            </template>
          </t-cell>
          <t-cell
            title="退款金额"
            t-class-description="refund-money__description"
            :description="amountTip"
            @tap="onAmountTap"
          >
            <template #note>
              <view class="service-from-group__wrapper flex flex-col font-[DIN_Alternate] [font-weight:bold] text-[36rpx] text-right text-[#fa4126]">
                <wr-price
                  :price="serviceFrom.amount.current"
                  fill
                  wr-class="refund-money-price-class"
                  symbol-class="refund-money-price-symbol"
                  decimal-class="refund-money-price-decimal"
                />
                <view class="service-from-group__price flex items-center text-[#bbb] text-[24rpx] relative left-[30rpx]">
                  修改
                  <template #left-icon>
                    <t-icon color="#bbb" name="chevron-right" size="30rpx" />
                  </template>
                </view>
              </view>
            </template>
          </t-cell>
        </t-cell-group>
      </view>
      <view class="service-from-group__textarea mt-[20rpx] bg-white p-[32rpx_32rpx_24rpx] [&_.t-textarea__wrapper_.t-textarea__wrapper-textarea]:h-[136rpx] [&_.t-textarea__wrapper_.t-textarea__wrapper-textarea]:box-border">
        <text class="textarea--label">
          退款说明
        </text>
        <t-textarea
          style="height: 220rpx"
          :value="serviceFrom.remark"
          t-class="textarea--content [margin-top:32rpx] ![background:#f5f5f5] [border-radius:16rpx]"
          maxlength="200"
          indicator
          placeholder="退款说明（选填）"
          @change="onRemarkChange"
        />
      </view>
      <view class="service-from-group__grid p-[0_32rpx_48rpx] [background:#fff] mb-[148rpx]">
        <t-upload
          :media-type="['image', 'video']"
          :files="serviceFrom.rightsImageUrls"
          :gridConfig="uploadGridConfig"
          max="3"
          @remove="handleRemove"
          @success="handleSuccess"
          @complete="handleComplete"
          @select-change="handleSelectChange"
        >
          <template #add-content>
            <view class="upload-addcontent-slot bg-[#f5f5f5] h-[inherit] flex flex-col items-center justify-center">
              <t-icon name="add" size="60rpx" />
              <view class="upload-desc text-center flex flex-col text-[24rpx] text-[#999]">
                <text>上传凭证</text>
                <text>（最多3张）</text>
              </view>
            </view>
          </template>
        </t-upload>
      </view>
      <view class="bottom-bar">
        <t-button
          :t-class="`bottom-bar__btn ${validateRes.valid && !uploading ? '' : 'disabled'}`"
          :loading="submitting"
          @tap="onSubmit"
        >
          提交
        </t-button>
      </view>
    </view>
  </view>
  <t-popup :visible="showReceiptStatusDialog" placement="bottom" @close="closeReceiptStatusDialog">
    <template #content>
      <view class="dialog--service-status bg-[#f3f4f5] overflow-hidden [&_.options_.option]:text-[#333333] [&_.options_.option]:text-[30rpx] [&_.options_.option]:text-center [&_.options_.option]:h-[100rpx] [&_.options_.option]:leading-[100rpx] [&_.options_.option]:bg-white [&_.options_.option--active]:opacity-50 [&_.options_.option_.main]:text-[#fa4126] [&_.cancel]:text-[#333333] [&_.cancel]:text-[30rpx] [&_.cancel]:text-center [&_.cancel]:h-[100rpx] [&_.cancel]:leading-[100rpx] [&_.cancel]:bg-white [&_.cancel]:mt-[20rpx] [&_.cancel--active]:opacity-50">
        <view class="options">
          <view
            v-for="(item, index) in receiptStatusList"
            :key="item.status ?? index"
            class="option"
            hover-class="option--active"
            :data-index="index"
            @tap="onReceiptStatusDialogConfirm"
          >
            {{ item.desc }}
          </view>
        </view>
        <view class="cancel" hover-class="cancel--active" @tap="closeReceiptStatusDialog">
          取消
        </view>
      </view>
    </template>
  </t-popup>
  <wr-reason-sheet id="wr-reason-sheet" />
  <t-dialog
    id="input-dialog"
    :visible="inputDialogVisible"
    :class="amountDialogClass"
    confirm-btn="确定"
    cancel-btn="取消"
    @confirm="onAmountDialogConfirm"
    @cancel="onAmountDialogCancel"
  >
    <template #title>
      <view class="input-dialog__title text-[#333] text-[32rpx] [font-weight:normal]">
        退款金额
      </view>
    </template>
    <template #content>
      <view class="input-dialog__content [&_.input-dialog__input]:text-[72rpx] [&_.input-dialog__input]:h-[64rpx] [&_.input-dialog__input]:leading-[64rpx] [&_.input]:text-[48rpx] [&_.input]:px-0 [&_.tips]:mt-[24rpx] [&_.tips]:text-[24rpx] [&_.tips]:text-[#999999]">
        <t-input
          t-class="input"
          t-class-input="input-dialog__input"
          t-class-label="input-dialog__label"
          placeholder=""
          :value="serviceFrom.amount.temp"
          type="digit"
          :focus="serviceFrom.amount.focus"
          label="¥"
          @input="onAmountInput"
          @focus="onAmountFocus"
          @blur="onAmountBlur"
        />
        <view class="tips">
          {{ amountTip }}
        </view>
      </view>
    </template>
  </t-dialog>
</template>
