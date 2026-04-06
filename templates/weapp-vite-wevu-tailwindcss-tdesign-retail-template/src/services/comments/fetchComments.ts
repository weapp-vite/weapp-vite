import type { GoodsAllCommentsResult } from '../../model/comments'
import { config } from '../../config/index'
import { getGoodsAllComments } from '../../model/comments'
import { delay } from '../_utils/delay'

export interface FetchCommentsParams {
  pageNum?: number
  pageSize?: number
  queryParameter?: {
    spuId?: string | number
    commentLevel?: number
    hasImage?: boolean
  }
}

/** 获取商品评论 */
function mockFetchComments(params?: FetchCommentsParams): Promise<GoodsAllCommentsResult> {
  return delay().then(() => getGoodsAllComments(params))
}

/** 获取商品评论 */
export function fetchComments(params?: FetchCommentsParams, _options?: unknown): Promise<GoodsAllCommentsResult> {
  if (config.useMock) {
    return mockFetchComments(params)
  }
  return Promise.resolve(getGoodsAllComments(params))
}
