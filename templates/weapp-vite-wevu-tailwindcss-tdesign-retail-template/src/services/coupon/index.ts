import type { CouponCardStatus } from '../../model/coupon'
import { config } from '../../config/index'
import { genAddressList } from '../../model/address'
import { getCoupon, getCouponList } from '../../model/coupon'
import { delay } from '../_utils/delay'

type CouponDetail = ReturnType<typeof getCoupon> & {
  useNotes?: string
  storeAdapt?: string
}

/** 获取优惠券列表 */
function mockFetchCoupon(status: CouponCardStatus) {
  return delay().then(() => getCouponList(status))
}

/** 获取优惠券列表 */
export function fetchCouponList(status: CouponCardStatus = 'default') {
  if (config.useMock) {
    return mockFetchCoupon(status)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}

/** 获取优惠券 详情 */
function mockFetchCouponDetail(id: number | string, status: CouponCardStatus) {
  return delay().then(() => {
    const detail: CouponDetail = getCoupon(Number(id), status)
    const result = {
      detail,
      storeInfoList: genAddressList(),
    }

    result.detail.useNotes = `1个订单限用1张，除运费券外，不能与其它类型的优惠券叠加使用（运费券除外）\n2.仅适用于各区域正常售卖商品，不支持团购、抢购、预售类商品`
    result.detail.storeAdapt = `商城通用`

    if (result.detail.type === 1) {
      result.detail.desc = `减免 ${result.detail.value / 100} 元`

      if (result.detail.base) {
        result.detail.desc += `，满${result.detail.base / 100}元可用`
      }

      result.detail.desc += '。'
    }
    else if (result.detail.type === 2) {
      result.detail.desc = `${result.detail.value}折`

      if (result.detail.base) {
        result.detail.desc += `，满${result.detail.base / 100}元可用`
      }

      result.detail.desc += '。'
    }

    return result
  })
}

/** 获取优惠券 详情 */
export function fetchCouponDetail(id: number | string, status: CouponCardStatus = 'default') {
  if (config.useMock) {
    return mockFetchCouponDetail(id, status)
  }
  return new Promise((resolve) => {
    resolve('real api')
  })
}
