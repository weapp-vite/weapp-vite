// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/functional-page-navigator.html
 */
export type WeappIntrinsicElementFunctionalPageNavigator = WeappIntrinsicElementBaseAttributes & {
  args?: Record<string, unknown>
  name?: 'chooseAddress' | 'chooseInvoice' | 'chooseInvoiceTitle' | 'loginAndGetUserInfo' | 'requestPayment'
  onCancel?: WevuJsxEventHandler
  onFail?: WevuJsxEventHandler
  onSuccess?: WevuJsxEventHandler
  version?: 'develop' | 'release' | 'trial'
}
