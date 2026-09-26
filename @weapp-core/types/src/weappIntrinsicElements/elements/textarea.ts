// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { WeappIntrinsicEventHandler } from '../base'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/textarea.html
 */
export type WeappIntrinsicElementTextarea = WeappIntrinsicElementBaseAttributes & {
  'adjust-keyboard-to'?: 'bottom' | 'cursor'
  'adjust-position'?: boolean
  'auto-focus'?: boolean
  'auto-height'?: boolean
  'confirm-hold'?: boolean
  'confirm-type'?: 'done' | 'go' | 'next' | 'return' | 'search' | 'send'
  cursor?: number
  'cursor-spacing'?: number
  'disable-default-padding'?: boolean
  disabled?: boolean
  fixed?: boolean
  focus?: boolean
  'hold-keyboard'?: boolean
  maxlength?: number
  onBlur?: WeappIntrinsicEventHandler
  onConfirm?: WeappIntrinsicEventHandler
  onFocus?: WeappIntrinsicEventHandler
  onInput?: WeappIntrinsicEventHandler
  onKeyboardHeightChange?: WeappIntrinsicEventHandler
  onKeyboardcompositionend?: WeappIntrinsicEventHandler
  onKeyboardcompositionstart?: WeappIntrinsicEventHandler
  onKeyboardcompositionupdate?: WeappIntrinsicEventHandler
  onLinechange?: WeappIntrinsicEventHandler
  onSelectionchange?: WeappIntrinsicEventHandler
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'selection-end'?: number
  'selection-start'?: number
  'show-confirm-bar'?: boolean
  value?: string
}
