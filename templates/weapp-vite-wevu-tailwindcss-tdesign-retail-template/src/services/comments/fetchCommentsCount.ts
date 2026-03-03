// @ts-nocheck
import { config } from '../../config/index'
import { getGoodsCommentsCount } from '../../model/comments'
import { delay } from '../_utils/delay'

/** 获取商品评论数 */
function mockFetchCommentsCount(ID = 0) {
  return delay().then(() => getGoodsCommentsCount(ID))
}

/** 获取商品评论数 */
export function fetchCommentsCount(ID = 0) {
  if (config.useMock) {
    return mockFetchCommentsCount(ID)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
