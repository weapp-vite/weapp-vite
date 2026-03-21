// @ts-nocheck
import { config } from '../../config/index'
import { genBusinessTime, genOrderDetail } from '../../model/order/orderDetail'
import { delay } from '../_utils/delay'

/** 获取订单详情mock数据 */
function mockFetchOrderDetail(params) {
  return delay().then(() => genOrderDetail(params))
}

/** 获取订单详情数据 */
export function fetchOrderDetail(params) {
  if (config.useMock) {
    return mockFetchOrderDetail(params)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}

/** 获取客服mock数据 */
function mockFetchBusinessTime(params) {
  return delay().then(() => genBusinessTime(params))
}

/** 获取客服数据 */
export function fetchBusinessTime(params) {
  if (config.useMock) {
    return mockFetchBusinessTime(params)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}
