// @ts-nocheck
import { config } from '../../config/index'
import { genAddress, genAddressList } from '../../model/address'
import { delay } from '../_utils/delay'

/** 获取收货地址 */
function mockFetchDeliveryAddress(id) {
  return delay().then(() => genAddress(id))
}

/** 获取收货地址 */
export function fetchDeliveryAddress(id = 0) {
  if (config.useMock) {
    return mockFetchDeliveryAddress(id)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}

/** 获取收货地址列表 */
function mockFetchDeliveryAddressList(len = 0) {
  return delay().then(() =>
    genAddressList(len).map((address) => {
      return {
        ...address,
        phoneNumber: address.phone,
        address: `${address.provinceName}${address.cityName}${address.districtName}${address.detailAddress}`,
        tag: address.addressTag,
      }
    }),
  )
}

/** 获取收货地址列表 */
export function fetchDeliveryAddressList(len = 10) {
  if (config.useMock) {
    return mockFetchDeliveryAddressList(len)
  }

  return new Promise((resolve) => {
    resolve('real api')
  })
}
