// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html
 */
export type MiniProgramIntrinsicElementCanvas = MiniProgramIntrinsicElementBaseAttributes & {
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindlongtap?: MiniProgramIntrinsicEventHandler<unknown>
  bindtouchcancel?: MiniProgramIntrinsicEventHandler<unknown>
  bindtouchend?: MiniProgramIntrinsicEventHandler<unknown>
  bindtouchmove?: MiniProgramIntrinsicEventHandler<unknown>
  bindtouchstart?: MiniProgramIntrinsicEventHandler<unknown>
  'canvas-id'?: string
  'disable-scroll'?: boolean
  type?: string
}

export type WeappIntrinsicElementCanvas = MiniProgramIntrinsicElementCanvas
