// @ts-nocheck
import { config } from '../../config/index'
import { genSettleDetail } from '../../model/order/orderConfirm'
import { mockIp, mockReqId } from '../../utils/mock'
import { delay } from '../_utils/delay'

/** 获取结算mock数据 */
function mockFetchSettleDetail(params) {
  return delay().then(() => genSettleDetail(params))
}

/** 提交mock订单 */
function mockDispatchCommitPay(_params?: unknown) {
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
export function fetchSettleDetail(params) {
  if (config.useMock) {
    return mockFetchSettleDetail(params)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}

/* 提交订单 */
export function dispatchCommitPay(params) {
  if (config.useMock) {
    return mockDispatchCommitPay(params)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}

/** 开发票 */
export function dispatchSupplementInvoice() {
  if (config.useMock) {
    return delay()
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}
