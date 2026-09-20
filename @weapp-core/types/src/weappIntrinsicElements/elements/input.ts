// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { WeappIntrinsicEventHandler } from '../base'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/input.html
 */
export type WeappIntrinsicElementInput = WeappIntrinsicElementBaseAttributes & {
  'adjust-position'?: boolean
  'always-embed'?: boolean
  'auto-focus'?: boolean
  'confirm-hold'?: boolean
  'confirm-type'?: 'done' | 'go' | 'next' | 'search' | 'send'
  cursor?: number
  'cursor-color'?: string
  'cursor-spacing'?: number
  disabled?: boolean
  focus?: boolean
  'hold-keyboard'?: boolean
  maxlength?: number
  onBlur?: WeappIntrinsicEventHandler
  onChange?: WeappIntrinsicEventHandler
  onConfirm?: WeappIntrinsicEventHandler
  onFocus?: WeappIntrinsicEventHandler
  onInput?: WeappIntrinsicEventHandler
  onKeyboardHeightChange?: WeappIntrinsicEventHandler
  onKeyboardcompositionend?: WeappIntrinsicEventHandler
  onKeyboardcompositionstart?: WeappIntrinsicEventHandler
  onKeyboardcompositionupdate?: WeappIntrinsicEventHandler
  onNicknameReview?: WeappIntrinsicEventHandler
  onSelectionchange?: WeappIntrinsicEventHandler
  password?: boolean
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'safe-password-cert-path'?: string
  'safe-password-custom-hash'?: string
  'safe-password-length'?: number
  'safe-password-nonce'?: string
  'safe-password-salt'?: string
  'safe-password-time-stamp'?: number
  'selection-end'?: number
  'selection-start'?: number
  type?: 'digit' | 'idcard' | 'nickname' | 'number' | 'safe-password' | 'text'
  value?: string
}
