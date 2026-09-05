// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/picker
 */
export type TtIntrinsicElementPicker = TtIntrinsicElementBaseAttributes & {
  'custom-item'?: string
  disabled?: boolean
  end?: string
  fields?: 'day' | 'month' | 'year'
  mode?: 'date' | 'multiSelector' | 'region' | 'selector' | 'time'
  onCancel?: WevuJsxEventHandler
  onChange?: WevuJsxEventHandler
  onColumnchange?: WevuJsxEventHandler
  range?: (Record<string, unknown> | string)[] | (Record<string, unknown> | string)[][]
  'range-key'?: string
  start?: string
  value?: number | number[] | string | string[]
}
