import { config } from '../../config/index'
import { getGoods as getGoodsModel } from '../../model/submitComment'
import { delay } from '../_utils/delay'

/** 获取评价商品 */
function mockGetGoods(parameter?: unknown) {
  const data = getGoodsModel(parameter)

  return delay().then(() => {
    return data
  })
}

/** 获取评价商品 */
export function getGoods(parameter?: unknown) {
  if (config.useMock) {
    return mockGetGoods(parameter)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
