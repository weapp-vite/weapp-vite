// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/progress.html
 */
export type MiniProgramIntrinsicElementProgress = MiniProgramIntrinsicElementBaseAttributes & {
  active?: boolean
  'active-mode'?: string
  activeColor?: string
  backgroundColor?: string
  bindactiveend?: MiniProgramIntrinsicEventHandler<unknown>
  'border-radius'?: number | string
  color?: string
  duration?: number
  'font-size'?: number | string
  percent?: number
  'show-info'?: boolean
  'stroke-width'?: number | string
}

export type WeappIntrinsicElementProgress = MiniProgramIntrinsicElementProgress
