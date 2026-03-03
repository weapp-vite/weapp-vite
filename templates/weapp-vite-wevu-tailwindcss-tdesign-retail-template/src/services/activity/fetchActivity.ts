import { config } from '../../config/index'
import { getActivity } from '../../model/activity'
import { delay } from '../_utils/delay'

/** 获取活动列表 */
function mockFetchActivity(ID = 0) {
  return delay().then(() => getActivity(ID))
}

/** 获取活动列表 */
export function fetchActivity(ID = 0) {
  if (config.useMock) {
    return mockFetchActivity(ID)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}
