// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/share-element.html
 */
export type WeappIntrinsicElementShareElement = WeappIntrinsicElementBaseAttributes & {
  duration?: number
  'easing-function'?: string
  key?: string
  'rect-tween-type'?: 'materialRectArc' | 'materialRectCenterArc' | 'linear' | 'elasticIn' | 'elasticOut' | 'elasticInOut' | 'bounceIn' | 'bounceOut' | 'bounceInOut' | 'cubic-bezier(x1, y1, x2, y2'
  'shuttle-on-pop'?: string
  'shuttle-on-push'?: 'from' | 'to'
  transform?: boolean
  'transition-on-gesture'?: boolean
  'worklet:onframe'?: WeappIntrinsicEventHandler<unknown>
}
