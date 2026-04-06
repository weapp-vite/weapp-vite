export type CouponCardStatus = 'default' | 'useless' | 'disabled'
export type CouponCardType = 1 | 2
export interface Coupon {
  key: string
  status: CouponCardStatus
  type: CouponCardType
  value: number
  tag: string
  desc: string
  base: number
  title: string
  timeLimit: string
  currency: string
}

/**
 * 优惠券
 *
 * @param {number} [id]
 * @param {CouponCardStatus} [status]
 * @param {CouponCardType} [type]
 */
export function getCoupon(
  id = 0,
  status: CouponCardStatus = 'default',
  type: CouponCardType = ((id % 2) + 1) as CouponCardType,
): Coupon {
  return {
    /** key */
    key: `${id}`,
    /** 优惠券状态 */
    status,
    /** 优惠券类型 */
    type,
    /** 折扣或者满减值 */
    value: type === 2 ? 5.5 : 1800,
    /** 标签 */
    tag: '',
    /** 描述 */
    desc: id > 0 ? `满${id * 100}元可用` : '无门槛使用',
    /** 订单底价,满n元 */
    base: 10000 * id,
    /** 标题 */
    title: type === 2 ? `生鲜折扣券 - ${id}` : `生鲜满减券 - ${id}`,
    /** 有效时间限制 */
    timeLimit: '2019.11.18-2023.12.18',
    /** 货币符号 */
    currency: '¥',
  }
}

/** 优惠券列表 */
export function getCouponList(status: CouponCardStatus = 'default', length = 10): Coupon[] {
  return new Array(length).fill(0).map((_, idx) => getCoupon(idx, status))
}
