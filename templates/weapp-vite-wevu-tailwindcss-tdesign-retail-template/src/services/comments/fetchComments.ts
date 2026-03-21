// @ts-nocheck
import { config } from '../../config/index'
import { getGoodsAllComments } from '../../model/comments'
import { delay } from '../_utils/delay'

/** 获取商品评论 */
function mockFetchComments(parmas) {
  return delay().then(() => getGoodsAllComments(parmas))
}

/** 获取商品评论 */
export function fetchComments(parmas) {
  if (config.useMock) {
    return mockFetchComments(parmas)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
