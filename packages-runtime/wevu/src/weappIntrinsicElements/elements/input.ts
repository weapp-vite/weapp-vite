// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/input.html
 */
export type WeappIntrinsicElementInput = WeappIntrinsicElementBaseAttributes & {
  'adjust-position'?: boolean
  'always-embed'?: boolean
  'auto-focus'?: boolean
  'bind:keyboardcompositionend'?: WeappIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionstart'?: WeappIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionupdate'?: WeappIntrinsicEventHandler<unknown>
  'bind:selectionchange'?: WeappIntrinsicEventHandler<unknown>
  bindblur?: WeappIntrinsicEventHandler<unknown>
  bindchange?: WeappIntrinsicEventHandler<unknown>
  bindconfirm?: WeappIntrinsicEventHandler<unknown>
  bindfocus?: WeappIntrinsicEventHandler<unknown>
  bindinput?: WeappIntrinsicEventHandler<unknown>
  bindkeyboardheightchange?: WeappIntrinsicEventHandler<unknown>
  bindnicknamereview?: WeappIntrinsicEventHandler<unknown>
  'confirm-hold'?: boolean
  'confirm-type'?: 'send' | 'search' | 'next' | 'go' | 'done'
  cursor?: number
  'cursor-color'?: string
  'cursor-spacing'?: number
  disabled?: boolean
  focus?: boolean
  'hold-keyboard'?: boolean
  maxlength?: number
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
  type?: 'text' | 'number' | 'idcard' | 'digit' | 'safe-password' | 'nickname'
  value?: string
  'worklet:onkeyboardheightchange'?: WeappIntrinsicEventHandler<unknown>
}
