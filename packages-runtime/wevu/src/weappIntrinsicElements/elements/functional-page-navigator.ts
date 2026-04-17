// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/functional-page-navigator.html
 */
export type MiniProgramIntrinsicElementFunctionalPageNavigator = MiniProgramIntrinsicElementBaseAttributes & {
  args?: Record<string, unknown>
  bindcancel?: MiniProgramIntrinsicEventHandler<unknown>
  bindfail?: MiniProgramIntrinsicEventHandler<unknown>
  bindsuccess?: MiniProgramIntrinsicEventHandler<unknown>
  name?: 'loginAndGetUserInfo' | 'requestPayment' | 'chooseAddress' | 'chooseInvoice' | 'chooseInvoiceTitle'
  version?: 'develop' | 'trial' | 'release'
}

export type WeappIntrinsicElementFunctionalPageNavigator = MiniProgramIntrinsicElementFunctionalPageNavigator
