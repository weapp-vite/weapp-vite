// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/form.html
 */
export type WeappIntrinsicElementForm = WeappIntrinsicElementBaseAttributes & {
  bindreset?: WeappIntrinsicEventHandler<unknown>
  bindsubmit?: WeappIntrinsicEventHandler<unknown>
  bindsubmitToGroup?: WeappIntrinsicEventHandler<unknown>
  name?: string
  'report-submit'?: boolean
  'report-submit-timeout'?: number
  value?: unknown
}
