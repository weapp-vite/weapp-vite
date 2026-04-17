// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/page-container.html
 */
export type MiniProgramIntrinsicElementPageContainer = MiniProgramIntrinsicElementBaseAttributes & {
  'bind:afterenter'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:afterleave'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:beforeenter'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:beforeleave'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:clickoverlay'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:enter'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:leave'?: MiniProgramIntrinsicEventHandler<unknown>
  'close-on-slide-down'?: boolean
  'custom-style'?: string
  duration?: number
  overlay?: boolean
  'overlay-style'?: string
  position?: string
  round?: boolean
  show?: boolean
  'z-index'?: number
}

export type WeappIntrinsicElementPageContainer = MiniProgramIntrinsicElementPageContainer
