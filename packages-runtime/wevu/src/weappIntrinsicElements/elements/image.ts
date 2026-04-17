// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/image.html
 */
export type MiniProgramIntrinsicElementImage = MiniProgramIntrinsicElementBaseAttributes & {
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindload?: MiniProgramIntrinsicEventHandler<unknown>
  'fade-in'?: boolean
  forceHttps?: boolean
  'lazy-load'?: boolean
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
  'show-menu-by-longpress'?: boolean
  src?: string
  webp?: boolean
}

export type WeappIntrinsicElementImage = MiniProgramIntrinsicElementImage
