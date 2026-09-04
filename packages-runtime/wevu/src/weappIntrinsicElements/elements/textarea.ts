// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
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
  onBlur?: WevuJsxEventHandler
  onConfirm?: WevuJsxEventHandler
  onFocus?: WevuJsxEventHandler
  onInput?: WevuJsxEventHandler
  onKeyboardHeightChange?: WevuJsxEventHandler
  onKeyboardcompositionend?: WevuJsxEventHandler
  onKeyboardcompositionstart?: WevuJsxEventHandler
  onKeyboardcompositionupdate?: WevuJsxEventHandler
  onLinechange?: WevuJsxEventHandler
  onSelectionchange?: WevuJsxEventHandler
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'selection-end'?: number
  'selection-start'?: number
  'show-confirm-bar'?: boolean
  value?: string
}
