import type { DispatchSupplementInvoiceResult, OrderCommitResult, SettleDetailParams, SettleDetailResult } from '../../model/order/orderConfirm'
import { config } from '../../config/index'
import { genSettleDetail } from '../../model/order/orderConfirm'
import { mockIp, mockReqId } from '../../utils/mock'
import { delay } from '../_utils/delay'

/** 获取结算mock数据 */
function mockFetchSettleDetail(params?: SettleDetailParams): Promise<SettleDetailResult> {
  return delay().then(() => genSettleDetail(params))
}

/** 提交mock订单 */
function mockDispatchCommitPay(_params?: unknown): Promise<OrderCommitResult> {
  return delay().then(() => ({
    data: {
      isSuccess: true,
      tradeNo: '350930961469409099',
      payInfo: '{}',
      code: null,
      transactionId: 'E-200915180100299000',
      msg: null,
      interactId: '15145',
      channel: 'wechat',
      limitGoodsList: null,
    },
    code: 'Success',
    msg: null,
    requestId: mockReqId(),
    clientIp: mockIp(),
    rt: 891,
    success: true,
  }))
}

/** 获取结算数据 */
export function fetchSettleDetail(params?: SettleDetailParams): Promise<SettleDetailResult> {
  if (config.useMock) {
    return mockFetchSettleDetail(params)
  }

  return Promise.resolve(genSettleDetail(params))
}

/* 提交订单 */
export function dispatchCommitPay(params?: unknown): Promise<OrderCommitResult> {
  if (config.useMock) {
    return mockDispatchCommitPay(params)
  }

  return mockDispatchCommitPay(params)
}

/** 开发票 */
export function dispatchSupplementInvoice(_params?: unknown): Promise<DispatchSupplementInvoiceResult> {
  if (config.useMock) {
    return delay().then(() => ({ success: true }))
  }

  return Promise.resolve({ success: true })
}
