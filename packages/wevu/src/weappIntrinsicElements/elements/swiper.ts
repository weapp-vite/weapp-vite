// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html
 */
export type WeappIntrinsicElementSwiper = WeappIntrinsicElementBaseAttributes & {
  autoplay?: boolean
  bindanimationfinish?: WeappIntrinsicEventHandler<unknown>
  bindchange?: WeappIntrinsicEventHandler<unknown>
  bindtransition?: WeappIntrinsicEventHandler<unknown>
  'cache-extent'?: number
  circular?: boolean
  current?: number
  direction?: 'all' | 'positive' | 'negative'
  'display-multiple-items'?: number
  duration?: number
  'easing-function'?: 'default' | 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  'indicator-active-color'?: string
  'indicator-alignment'?: number[] | string
  'indicator-color'?: string
  'indicator-dots'?: boolean
  'indicator-height'?: number
  'indicator-margin'?: number
  'indicator-offset'?: number[]
  'indicator-radius'?: number
  'indicator-spacing'?: number
  'indicator-type'?: 'normal' | 'worm' | 'wormThin' | 'wormUnderground' | 'wormThinUnderground' | 'expand' | 'jump' | 'jumpWithOffset' | 'scroll' | 'scrollFixedCenter' | 'slide' | 'slideUnderground' | 'scale' | 'swap' | 'swapYRotation' | 'color'
  'indicator-width'?: number
  interval?: number
  'layout-type'?: 'normal' | 'stackLeft' | 'stackRight' | 'tinder' | 'transformer'
  'next-margin'?: string
  'previous-margin'?: string
  'scroll-with-animation'?: boolean
  'snap-to-edge'?: boolean
  'transformer-type'?: 'scaleAndFade' | 'accordion' | 'threeD' | 'zoomIn' | 'zoomOut' | 'deepthPage'
  vertical?: boolean
  'worklet:onscrollend'?: WeappIntrinsicEventHandler<unknown>
  'worklet:onscrollstart'?: WeappIntrinsicEventHandler<unknown>
  'worklet:onscrollupdate'?: WeappIntrinsicEventHandler<unknown>
}
