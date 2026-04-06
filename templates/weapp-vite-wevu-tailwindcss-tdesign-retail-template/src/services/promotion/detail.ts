import type { Promotion } from '../../model/promotion'
import { config } from '../../config/index'
import { getPromotion } from '../../model/promotion'
import { delay } from '../_utils/delay'

/** 获取商品列表 */
function mockFetchPromotion(ID = 0): Promise<Promotion> {
  return delay().then(() => getPromotion(ID))
}

/** 获取商品列表 */
export function fetchPromotion(ID = 0): Promise<Promotion> {
  if (config.useMock) {
    return mockFetchPromotion(ID)
  }
  return Promise.resolve(getPromotion(ID))
}
