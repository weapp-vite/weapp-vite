// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html
 */
export type WeappIntrinsicElementSwiperItem = WeappIntrinsicElementBaseAttributes & {
  autoplay?: boolean
  'cache-extent'?: number
  circular?: boolean
  current?: number
  direction?: 'all' | 'negative' | 'positive'
  'display-multiple-items'?: number
  duration?: number
  'easing-function'?: 'default' | 'easeInCubic' | 'easeInOutCubic' | 'easeOutCubic' | 'linear'
  'indicator-active-color'?: string
  'indicator-alignment'?: number[] | string
  'indicator-color'?: string
  'indicator-dots'?: boolean
  'indicator-height'?: number
  'indicator-margin'?: number
  'indicator-offset'?: number[]
  'indicator-radius'?: number
  'indicator-spacing'?: number
  'indicator-type'?: 'color' | 'expand' | 'jump' | 'jumpWithOffset' | 'normal' | 'scale' | 'scroll' | 'scrollFixedCenter' | 'slide' | 'slideUnderground' | 'swap' | 'swapYRotation' | 'worm' | 'wormThin' | 'wormThinUnderground' | 'wormUnderground'
  'indicator-width'?: number
  interval?: number
  'layout-type'?: 'normal' | 'stackLeft' | 'stackRight' | 'tinder' | 'transformer'
  'next-margin'?: string
  onAnimationfinish?: WevuJsxEventHandler
  onChange?: WevuJsxEventHandler
  onTransition?: WevuJsxEventHandler
  'previous-margin'?: string
  'scroll-with-animation'?: boolean
  'snap-to-edge'?: boolean
  'transformer-type'?: 'accordion' | 'deepthPage' | 'scaleAndFade' | 'threeD' | 'zoomIn' | 'zoomOut'
  vertical?: boolean
}
