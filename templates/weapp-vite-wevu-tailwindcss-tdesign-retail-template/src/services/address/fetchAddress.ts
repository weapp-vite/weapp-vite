import type { Address, DeliveryAddress } from '../../model/address'
import { config } from '../../config/index'
import { genAddress, genAddressList } from '../../model/address'
import { delay } from '../_utils/delay'

/** 获取收货地址 */
function mockFetchDeliveryAddress(id: number | string): Promise<Address> {
  return delay().then(() => genAddress(Number(id)))
}

/** 获取收货地址 */
export function fetchDeliveryAddress(id: number | string = 0): Promise<Address> {
  if (config.useMock) {
    return mockFetchDeliveryAddress(id)
  }

  return Promise.resolve(genAddress(Number(id)))
}

/** 获取收货地址列表 */
function mockFetchDeliveryAddressList(len = 0): Promise<DeliveryAddress[]> {
  return delay().then(() =>
    genAddressList(len).map((address): DeliveryAddress => {
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
export function fetchDeliveryAddressList(len = 10): Promise<DeliveryAddress[]> {
  if (config.useMock) {
    return mockFetchDeliveryAddressList(len)
  }

  return Promise.resolve(
    genAddressList(len).map((address): DeliveryAddress => ({
      ...address,
      phoneNumber: address.phone,
      address: `${address.provinceName}${address.cityName}${address.districtName}${address.detailAddress}`,
      tag: address.addressTag,
    })),
  )
}
