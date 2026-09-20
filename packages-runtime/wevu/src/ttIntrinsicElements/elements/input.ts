// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/input
 */
export type TtIntrinsicElementInput = TtIntrinsicElementBaseAttributes & {
  'adjust-position'?: boolean
  'confirm-hold'?: boolean
  'confirm-type'?: 'done' | 'go' | 'next' | 'search' | 'send'
  cursor?: number
  'cursor-spacing'?: number
  disabled?: boolean
  focus?: boolean
  'hold-keyboard'?: boolean
  maxlength?: number
  onBlur?: WevuJsxEventHandler
  onConfirm?: WevuJsxEventHandler
  onFocus?: WevuJsxEventHandler
  onInput?: WevuJsxEventHandler
  onKeyboardHeightChange?: WevuJsxEventHandler
  password?: boolean
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'selection-end'?: number
  'selection-start'?: number
  type?: 'digit' | 'number' | 'text'
  value?: string
}
