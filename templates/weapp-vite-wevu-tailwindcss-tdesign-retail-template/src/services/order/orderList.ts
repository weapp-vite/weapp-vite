import type { OrdersCountResult, OrdersResult } from '../../model/order/orderList'
import { config } from '../../config/index'
import { genOrders, genOrdersCount } from '../../model/order/orderList'
import { delay } from '../_utils/delay'

export interface FetchOrdersParams {
  parameter: {
    pageSize: number
    pageNum: number
    orderStatus?: number
  }
}

/** 获取订单列表mock数据 */
function mockFetchOrders(params?: FetchOrdersParams): Promise<OrdersResult> {
  return delay(200).then(() => genOrders(params as Record<string, any>))
}

/** 获取订单列表数据 */
export function fetchOrders(params?: FetchOrdersParams): Promise<OrdersResult> {
  if (config.useMock) {
    return mockFetchOrders(params)
  }

  return Promise.resolve(genOrders(params as Record<string, any>))
}

/** 获取订单列表mock数据 */
function mockFetchOrdersCount(params?: unknown): Promise<OrdersCountResult> {
  return delay().then(() => genOrdersCount(params))
}

/** 获取订单列表统计 */
export function fetchOrdersCount(params?: unknown): Promise<OrdersCountResult> {
  if (config.useMock) {
    return mockFetchOrdersCount(params)
  }

  return Promise.resolve(genOrdersCount(params))
}
