import { config } from '../../config/index'
import {
  getGoodsDetailsComments,
  getGoodsDetailsCommentsCount as getGoodsDetailsCommentsCountModel,
} from '../../model/detailsComments'
import { delay } from '../_utils/delay'

/** 获取商品详情页评论数 */
function mockFetchGoodDetailsCommentsCount(spuId = 0) {
  return delay().then(() => getGoodsDetailsCommentsCountModel(spuId))
}

/** 获取商品详情页评论数 */
export function getGoodsDetailsCommentsCount(spuId = 0) {
  if (config.useMock) {
    return mockFetchGoodDetailsCommentsCount(spuId)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}

/** 获取商品详情页评论 */
function mockFetchGoodDetailsCommentList(spuId = 0) {
  return delay().then(() => getGoodsDetailsComments(spuId))
}

/** 获取商品详情页评论 */
export function getGoodsDetailsCommentList(spuId = 0) {
  if (config.useMock) {
    return mockFetchGoodDetailsCommentList(spuId)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
