// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/picker.html
 */
export type WeappIntrinsicElementPicker = WeappIntrinsicElementBaseAttributes & {
  'custom-item'?: string
  disabled?: boolean
  end?: string
  fields?: string
  'header-text'?: string
  level?: string
  mode?: 'date' | 'multiSelector' | 'region' | 'selector' | 'time'
  onCancel?: WevuJsxEventHandler
  onChange?: WevuJsxEventHandler
  onColumnchange?: WevuJsxEventHandler
  range?: Record<string, unknown>[] | unknown[]
  'range-key'?: string
  start?: string
  value?: unknown[]
}
