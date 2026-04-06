import type { GoodsCommentsCount } from '../../model/comments'
import { config } from '../../config/index'
import { getGoodsCommentsCount } from '../../model/comments'
import { delay } from '../_utils/delay'

function normalizeSpuId(input: string | number | { spuId?: string | number } = 0) {
  const spuId = typeof input === 'object' && input !== null ? input.spuId : input
  if (typeof spuId === 'string') {
    return Number(spuId) || 0
  }
  return spuId ?? 0
}

/** 获取商品评论数 */
function mockFetchCommentsCount(ID: string | number | { spuId?: string | number } = 0): Promise<GoodsCommentsCount> {
  return delay().then(() => getGoodsCommentsCount(normalizeSpuId(ID)))
}

/** 获取商品评论数 */
export function fetchCommentsCount(ID: string | number | { spuId?: string | number } = 0, _options?: unknown): Promise<GoodsCommentsCount> {
  if (config.useMock) {
    return mockFetchCommentsCount(ID)
  }
  return Promise.resolve(getGoodsCommentsCount(normalizeSpuId(ID)))
}
