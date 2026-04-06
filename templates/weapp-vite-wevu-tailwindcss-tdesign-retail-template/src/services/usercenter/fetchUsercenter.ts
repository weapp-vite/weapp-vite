import type { UsercenterData } from '../../model/usercenter'
import { config } from '../../config/index'
import { genUsercenter } from '../../model/usercenter'
import { delay } from '../_utils/delay'

/** 获取个人中心信息 */
function mockFetchUserCenter(): Promise<UsercenterData> {
  return delay(200).then(() => genUsercenter())
}

/** 获取个人中心信息 */
export function fetchUserCenter(): Promise<UsercenterData> {
  if (config.useMock) {
    return mockFetchUserCenter()
  }
  return Promise.resolve(genUsercenter())
}
