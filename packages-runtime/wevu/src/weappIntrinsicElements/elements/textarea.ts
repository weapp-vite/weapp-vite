// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/textarea.html
 */
export type MiniProgramIntrinsicElementTextarea = MiniProgramIntrinsicElementBaseAttributes & {
  'adjust-keyboard-to'?: 'cursor' | 'bottom'
  'adjust-position'?: boolean
  'auto-focus'?: boolean
  'auto-height'?: boolean
  'bind:keyboardcompositionend'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionstart'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionupdate'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:selectionchange'?: MiniProgramIntrinsicEventHandler<unknown>
  bindblur?: MiniProgramIntrinsicEventHandler<unknown>
  bindconfirm?: MiniProgramIntrinsicEventHandler<unknown>
  bindfocus?: MiniProgramIntrinsicEventHandler<unknown>
  bindinput?: MiniProgramIntrinsicEventHandler<unknown>
  bindkeyboardheightchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindlinechange?: MiniProgramIntrinsicEventHandler<unknown>
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

export type WeappIntrinsicElementTextarea = MiniProgramIntrinsicElementTextarea
