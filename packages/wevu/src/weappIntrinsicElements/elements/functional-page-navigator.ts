// 此文件由 components.json 自动生成，请勿直接修改。

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/functional-page-navigator.html
 */
export type WeappIntrinsicElementFunctionalPageNavigator = WeappIntrinsicElementBaseAttributes & {
  args?: Record<string, unknown>
  bindcancel?: WeappIntrinsicEventHandler<unknown>
  bindfail?: WeappIntrinsicEventHandler<unknown>
  bindsuccess?: WeappIntrinsicEventHandler<unknown>
  name?: 'loginAndGetUserInfo' | 'requestPayment' | 'chooseAddress' | 'chooseInvoice' | 'chooseInvoiceTitle'
  version?: 'develop' | 'trial' | 'release'
}
