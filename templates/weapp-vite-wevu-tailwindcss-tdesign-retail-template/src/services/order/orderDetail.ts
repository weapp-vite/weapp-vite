import type { BusinessTimeResult, OrderDetailResult } from '../../model/order/orderDetail'
import { config } from '../../config/index'
import { genBusinessTime, genOrderDetail } from '../../model/order/orderDetail'
import { delay } from '../_utils/delay'

/** 获取订单详情mock数据 */
function mockFetchOrderDetail(params?: unknown): Promise<OrderDetailResult> {
  return delay().then(() => genOrderDetail(params as { parameter?: string }) as OrderDetailResult)
}

/** 获取订单详情数据 */
export function fetchOrderDetail(params?: unknown): Promise<OrderDetailResult> {
  if (config.useMock) {
    return mockFetchOrderDetail(params)
  }

  return Promise.resolve(genOrderDetail(params as { parameter?: string }) as OrderDetailResult)
}

/** 获取客服mock数据 */
function mockFetchBusinessTime(params?: unknown): Promise<BusinessTimeResult> {
  return delay().then(() => genBusinessTime(params))
}

/** 获取客服数据 */
export function fetchBusinessTime(params?: unknown): Promise<BusinessTimeResult> {
  if (config.useMock) {
    return mockFetchBusinessTime(params)
  }

  return Promise.resolve(genBusinessTime(params))
}
