// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html
 */
export type WeappIntrinsicElementPickerViewColumn = WeappIntrinsicElementBaseAttributes & {
  bindchange?: WeappIntrinsicEventHandler<unknown>
  bindpickend?: WeappIntrinsicEventHandler<unknown>
  bindpickstart?: WeappIntrinsicEventHandler<unknown>
  'immediate-change'?: boolean
  'indicator-class'?: string
  'indicator-style'?: string
  'mask-class'?: string
  'mask-style'?: string
  value?: number[]
}
