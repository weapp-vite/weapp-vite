import type { ApplyReasonListResponse, ApplyServiceResponse, RightsPreviewResponse } from '../../model/order/applyService'
import { config } from '../../config/index'
import {

  applyService,

  genApplyReasonList,
  genRightsPreview,

} from '../../model/order/applyService'
import { delay } from '../_utils/delay'

export interface FetchRightsPreviewParams {
  orderNo?: string
  skuId?: string
  spuId?: string
  numOfSku?: number
}

export interface FetchApplyReasonListParams {
  rightsReasonType?: string | number | null
}

export interface DispatchConfirmReceivedParams {
  parameter?: {
    logisticsNo?: string
    orderNo?: string
  }
}

export interface DispatchApplyServicePayload {
  rights: {
    orderNo?: string
    refundRequestAmount: number
    rightsImageUrls: unknown[]
    rightsReasonDesc: string
    rightsReasonType: string | number | null
    rightsType: number
  }
  rightsItem: Array<{
    itemTotalAmount: number
    rightsQuantity: number
    skuId?: string
    spuId?: string
  }>
  refundMemo: string
}

/** 获取售后单mock数据 */
function mockFetchRightsPreview(params: FetchRightsPreviewParams = {}) {
  return delay().then(() => {
    const response = genRightsPreview(params)
    if (!response) {
      throw new Error('未找到售后预览数据')
    }
    return response
  })
}

/** 获取售后单数据 */
export function fetchRightsPreview(params: FetchRightsPreviewParams = {}) {
  if (config.useMock) {
    return mockFetchRightsPreview(params)
  }

  return new Promise<RightsPreviewResponse>((resolve) => {
    resolve(genRightsPreview(params) ?? {
      data: {
        saasId: '',
        uid: '',
        storeId: '',
        skuId: params.skuId ?? '',
        numOfSku: params.numOfSku ?? 1,
        numOfSkuAvailable: params.numOfSku ?? 1,
        refundableAmount: '0',
        refundableDiscountAmount: '0',
        shippingFeeIncluded: '0',
        paidAmountEach: '0',
        boughtQuantity: 0,
        orderNo: params.orderNo ?? '',
        goodsInfo: {
          goodsName: '',
          skuImage: '',
          specInfo: [],
        },
        spuId: params.spuId,
      },
      code: 'Success',
      msg: null,
      requestId: '',
      clientIp: '',
      rt: 0,
      success: true,
    })
  })
}

/** 确认收货 */
export function dispatchConfirmReceived(_params: DispatchConfirmReceivedParams = {}) {
  if (config.useMock) {
    return delay().then(() => undefined)
  }

  return new Promise<void>((resolve) => {
    resolve()
  })
}

/** 获取可选的mock售后原因列表 */
function mockFetchApplyReasonList(params: FetchApplyReasonListParams = {}) {
  return delay().then(() => genApplyReasonList(params))
}

/** 获取可选的售后原因列表 */
export function fetchApplyReasonList(params: FetchApplyReasonListParams = {}) {
  if (config.useMock) {
    return mockFetchApplyReasonList(params)
  }

  return new Promise<ApplyReasonListResponse>((resolve) => {
    resolve(genApplyReasonList(params))
  })
}

/** 发起mock售后申请 */
function mockDispatchApplyService(params: DispatchApplyServicePayload) {
  return delay().then(() => applyService(params))
}

/** 发起售后申请 */
export function dispatchApplyService(params: DispatchApplyServicePayload) {
  if (config.useMock) {
    return mockDispatchApplyService(params)
  }

  return new Promise<ApplyServiceResponse>((resolve) => {
    resolve(applyService(params))
  })
}
