// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { TtIntrinsicEventHandler } from '../base'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/textarea
 */
export type TtIntrinsicElementTextarea = TtIntrinsicElementBaseAttributes & {
  'adjust-position'?: boolean
  'auto-height'?: boolean
  'confirm-hold'?: boolean
  'confirm-type'?: string
  cursor?: number
  'cursor-spacing'?: number
  'disable-default-padding'?: boolean
  disabled?: boolean
  focus?: boolean
  'hold-keyboard'?: boolean
  maxlength?: number
  onBlur?: TtIntrinsicEventHandler
  onConfirm?: TtIntrinsicEventHandler
  onFocus?: TtIntrinsicEventHandler
  onInput?: TtIntrinsicEventHandler
  onKeyboardHeightChange?: TtIntrinsicEventHandler
  onLinechange?: TtIntrinsicEventHandler
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'selection-end'?: number
  'selection-start'?: number
  'show-confirm-bar'?: boolean
  value?: string
}
