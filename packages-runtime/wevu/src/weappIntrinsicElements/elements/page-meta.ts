// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/page-meta.html
 */
export type MiniProgramIntrinsicElementPageMeta = MiniProgramIntrinsicElementBaseAttributes & {
  'background-color'?: string
  'background-color-bottom'?: string
  'background-color-top'?: string
  'background-text-style'?: string
  bindresize?: MiniProgramIntrinsicEventHandler<unknown>
  bindscroll?: MiniProgramIntrinsicEventHandler<unknown>
  bindscrolldone?: MiniProgramIntrinsicEventHandler<unknown>
  'page-font-size'?: string
  'page-orientation'?: string
  'page-style'?: string
  'root-background-color'?: string
  'root-font-size'?: string
  'scroll-duration'?: number
  'scroll-top'?: string
}

export type WeappIntrinsicElementPageMeta = MiniProgramIntrinsicElementPageMeta
