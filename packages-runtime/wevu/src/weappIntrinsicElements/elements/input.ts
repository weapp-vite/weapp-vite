// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/input.html
 */
export type MiniProgramIntrinsicElementInput = MiniProgramIntrinsicElementBaseAttributes & {
  'adjust-position'?: boolean
  'always-embed'?: boolean
  'auto-focus'?: boolean
  'bind:keyboardcompositionend'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionstart'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:keyboardcompositionupdate'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:selectionchange'?: MiniProgramIntrinsicEventHandler<unknown>
  bindblur?: MiniProgramIntrinsicEventHandler<unknown>
  bindchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindconfirm?: MiniProgramIntrinsicEventHandler<unknown>
  bindfocus?: MiniProgramIntrinsicEventHandler<unknown>
  bindinput?: MiniProgramIntrinsicEventHandler<unknown>
  bindkeyboardheightchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindnicknamereview?: MiniProgramIntrinsicEventHandler<unknown>
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
  'worklet:onkeyboardheightchange'?: MiniProgramIntrinsicEventHandler<unknown>
}

export type WeappIntrinsicElementInput = MiniProgramIntrinsicElementInput
