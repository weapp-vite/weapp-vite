import type { GoodsDetailsComments, GoodsDetailsCommentsCount } from '../../model/detailsComments'
import { config } from '../../config/index'
import {
  getGoodsDetailsComments,
  getGoodsDetailsCommentsCount as getGoodsDetailsCommentsCountModel,
} from '../../model/detailsComments'
import { delay } from '../_utils/delay'

function normalizeSpuId(spuId: string | number) {
  return typeof spuId === 'string' ? Number(spuId) || 0 : spuId
}

/** 获取商品详情页评论数 */
function mockFetchGoodDetailsCommentsCount(spuId: string | number = 0): Promise<GoodsDetailsCommentsCount> {
  return delay().then(() => getGoodsDetailsCommentsCountModel(normalizeSpuId(spuId)))
}

/** 获取商品详情页评论数 */
export function getGoodsDetailsCommentsCount(spuId: string | number = 0): Promise<GoodsDetailsCommentsCount> {
  if (config.useMock) {
    return mockFetchGoodDetailsCommentsCount(spuId)
  }
  return Promise.resolve(getGoodsDetailsCommentsCountModel(normalizeSpuId(spuId)))
}

/** 获取商品详情页评论 */
function mockFetchGoodDetailsCommentList(spuId: string | number = 0): Promise<GoodsDetailsComments> {
  return delay().then(() => getGoodsDetailsComments(normalizeSpuId(spuId)))
}

/** 获取商品详情页评论 */
export function getGoodsDetailsCommentList(spuId: string | number = 0): Promise<GoodsDetailsComments> {
  if (config.useMock) {
    return mockFetchGoodDetailsCommentList(spuId)
  }
  return Promise.resolve(getGoodsDetailsComments(normalizeSpuId(spuId)))
}
