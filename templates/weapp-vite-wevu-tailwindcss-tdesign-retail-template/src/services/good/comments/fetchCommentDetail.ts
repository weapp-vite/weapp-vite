import { config } from '../../../config/index'
import { queryCommentDetail } from '../../../model/comments/queryDetail'
import { delay } from '../../_utils/delay'

/** 获取商品评价数据 */
function mockQueryCommentDetail(params?: unknown) {
  const data = queryCommentDetail(params)
  return delay().then(() => {
    return data
  })
}

/** 获取评价详情 */
export function getCommentDetail(params?: unknown) {
  if (config.useMock) {
    return mockQueryCommentDetail(params)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
