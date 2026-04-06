import type { GoodDetail } from '../../model/good'
import { config } from '../../config/index'
import { genGood } from '../../model/good'
import { delay } from '../_utils/delay'

/** 获取商品列表 */
function mockFetchGood(ID: string | number = 0): Promise<GoodDetail> {
  return delay().then(() => genGood(String(ID)))
}

/** 获取商品列表 */
export function fetchGood(ID: string | number = 0): Promise<GoodDetail> {
  if (config.useMock) {
    return mockFetchGood(ID)
  }
  return Promise.resolve(genGood(String(ID)))
}
