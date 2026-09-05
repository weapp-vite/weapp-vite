// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html
 * @see https://opendocs.alipay.com/mini/component/swiper
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/view-container/swiper
 */
export type MiniProgramIntrinsicElementSwiper = MiniProgramIntrinsicElementBaseAttributes & {
  autoplay?: boolean
  circular?: boolean
  current?: number
  'display-multiple-items'?: number
  duration?: number
  'easing-function'?: 'default' | 'easeInCubic' | 'easeInOutCubic' | 'easeOutCubic' | 'linear'
  'indicator-dots'?: boolean
  interval?: number
  'next-margin'?: string
  onChange?: WevuJsxEventHandler
  onTransition?: WevuJsxEventHandler
  'previous-margin'?: string
  vertical?: boolean
}
