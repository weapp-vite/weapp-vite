import type { ActivityList } from '../../model/activities'
import { config } from '../../config/index'
import { getActivityList } from '../../model/activities'
import { delay } from '../_utils/delay'

/** 获取活动列表 */
function mockFetchActivityList(pageIndex = 1, pageSize = 20): Promise<ActivityList> {
  return delay().then(() => getActivityList(pageIndex, pageSize))
}

/** 获取活动列表 */
export function fetchActivityList(pageIndex = 1, pageSize = 20): Promise<ActivityList> {
  if (config.useMock) {
    return mockFetchActivityList(pageIndex, pageSize)
  }

  return Promise.resolve(getActivityList(pageIndex, pageSize))
}
