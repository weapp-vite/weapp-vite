import { config } from '../../config/index'
import { genCartGroupData } from '../../model/cart'
import { delay } from '../_utils/delay'

/** 获取购物车mock数据 */
function mockFetchCartGroupData(params?: unknown) {
  return delay().then(() => genCartGroupData(params))
}

/** 获取购物车数据 */
export function fetchCartGroupData(params?: unknown) {
  if (config.useMock) {
    return mockFetchCartGroupData(params)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}
