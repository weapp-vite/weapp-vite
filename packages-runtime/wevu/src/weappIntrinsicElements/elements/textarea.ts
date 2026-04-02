// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/textarea.html
 */
export type WeappIntrinsicElementTextarea = WeappIntrinsicElementBaseAttributes & {
  'adjust-keyboard-to'?: 'cursor' | 'bottom'
  'adjust-position'?: boolean
  'auto-focus'?: boolean
  'auto-height'?: boolean
  'bind:keyboardcompositionend'?: WeappIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionstart'?: WeappIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionupdate'?: WeappIntrinsicEventHandler<unknown>
  'bind:selectionchange'?: WeappIntrinsicEventHandler<unknown>
  bindblur?: WeappIntrinsicEventHandler<unknown>
  bindconfirm?: WeappIntrinsicEventHandler<unknown>
  bindfocus?: WeappIntrinsicEventHandler<unknown>
  bindinput?: WeappIntrinsicEventHandler<unknown>
  bindkeyboardheightchange?: WeappIntrinsicEventHandler<unknown>
  bindlinechange?: WeappIntrinsicEventHandler<unknown>
  'confirm-hold'?: boolean
  'confirm-type'?: 'send' | 'search' | 'next' | 'go' | 'done' | 'return'
  cursor?: number
  'cursor-spacing'?: number
  'disable-default-padding'?: boolean
  disabled?: boolean
  fixed?: boolean
  focus?: boolean
  'hold-keyboard'?: boolean
  maxlength?: number
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'selection-end'?: number
  'selection-start'?: number
  'show-confirm-bar'?: boolean
  value?: string
}
