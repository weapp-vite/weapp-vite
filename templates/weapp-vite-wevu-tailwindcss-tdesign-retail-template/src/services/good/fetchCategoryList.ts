// @ts-nocheck
import { config } from '../../config/index'
import { getCategoryList as getCategoryListModel } from '../../model/category'
import { delay } from '../_utils/delay'

/** 获取商品列表 */
function mockFetchGoodCategory() {
  return delay().then(() => getCategoryListModel())
}

/** 获取商品列表 */
export function getCategoryList() {
  if (config.useMock) {
    return mockFetchGoodCategory()
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
