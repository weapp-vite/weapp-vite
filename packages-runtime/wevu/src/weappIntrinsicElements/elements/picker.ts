// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/picker.html
 */
export type WeappIntrinsicElementPicker = WeappIntrinsicElementBaseAttributes & {
  bindcancel?: WeappIntrinsicEventHandler<unknown>
  bindchange?: WeappIntrinsicEventHandler<unknown>
  bindcolumnchange?: WeappIntrinsicEventHandler<unknown>
  'custom-item'?: string
  disabled?: boolean
  end?: string
  fields?: string
  'header-text'?: string
  level?: string
  mode?: 'selector' | 'multiSelector' | 'time' | 'date' | 'region'
  range?: unknown[] | Record<string, unknown>[]
  'range-key'?: string
  start?: string
  value?: unknown[]
}
