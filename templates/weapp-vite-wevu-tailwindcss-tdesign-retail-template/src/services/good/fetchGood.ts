import { config } from '../../config/index'
import { genGood } from '../../model/good'
import { delay } from '../_utils/delay'

/** 获取商品列表 */
function mockFetchGood(ID = 0) {
  return delay().then(() => genGood(ID))
}

/** 获取商品列表 */
export function fetchGood(ID = 0) {
  if (config.useMock) {
    return mockFetchGood(ID)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
