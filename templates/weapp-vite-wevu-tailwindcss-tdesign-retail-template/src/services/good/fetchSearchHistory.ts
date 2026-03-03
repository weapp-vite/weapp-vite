import { config } from '../../config/index'
import {
  getSearchHistory as getSearchHistoryModel,
  getSearchPopular as getSearchPopularModel,
} from '../../model/search'
import { delay } from '../_utils/delay'

/** 获取搜索历史 */
function mockSearchHistory() {
  return delay().then(() => getSearchHistoryModel())
}

/** 获取搜索历史 */
export function getSearchHistory() {
  if (config.useMock) {
    return mockSearchHistory()
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}

/** 获取搜索历史 */
function mockSearchPopular() {
  return delay().then(() => getSearchPopularModel())
}

/** 获取搜索历史 */
export function getSearchPopular() {
  if (config.useMock) {
    return mockSearchPopular()
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
