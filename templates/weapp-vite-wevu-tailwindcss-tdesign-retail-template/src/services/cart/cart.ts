// @ts-nocheck
import { config } from '../../config/index'
import { genCartGroupData } from '../../model/cart'
import { delay } from '../_utils/delay'

/** 获取购物车mock数据 */
function mockFetchCartGroupData(params) {
  return delay().then(() => genCartGroupData(params))
}

/** 获取购物车数据 */
export function fetchCartGroupData(params) {
  if (config.useMock) {
    return mockFetchCartGroupData(params)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}
