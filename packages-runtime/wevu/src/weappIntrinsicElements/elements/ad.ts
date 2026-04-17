// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/ad.html
 */
export type MiniProgramIntrinsicElementAd = MiniProgramIntrinsicElementBaseAttributes & {
  'ad-intervals'?: number
  'ad-theme'?: string
  'ad-type'?: string
  bindclose?: MiniProgramIntrinsicEventHandler<unknown>
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindload?: MiniProgramIntrinsicEventHandler<unknown>
  'unit-id'?: string
}

export type WeappIntrinsicElementAd = MiniProgramIntrinsicElementAd
