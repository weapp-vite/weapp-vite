// @ts-nocheck
import { config } from '../../config/index'
import { genAddress } from '../../model/address'
import { genSimpleUserInfo } from '../../model/usercenter'
import { delay } from '../_utils/delay'

/** 获取个人中心信息 */
function mockFetchPerson() {
  const address = genAddress()
  return delay().then(() => ({
    ...genSimpleUserInfo(),
    address: {
      provinceName: address.provinceName,
      provinceCode: address.provinceCode,
      cityName: address.cityName,
      cityCode: address.cityCode,
    },
  }))
}

/** 获取个人中心信息 */
export function fetchPerson() {
  if (config.useMock) {
    return mockFetchPerson()
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
