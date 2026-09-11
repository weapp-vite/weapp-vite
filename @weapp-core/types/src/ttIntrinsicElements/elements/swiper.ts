// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { TtIntrinsicEventHandler } from '../base'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/view-container/swiper
 */
export type TtIntrinsicElementSwiper = TtIntrinsicElementBaseAttributes & {
  autoplay?: boolean
  circular?: boolean
  current?: number
  'current-item-id'?: string
  'display-multiple-items'?: number
  duration?: number
  'easing-function'?: string
  'indicator-active-color'?: string
  'indicator-color'?: string
  'indicator-dots'?: boolean
  interval?: number
  'next-margin'?: string
  onAnimationfinish?: TtIntrinsicEventHandler
  onChange?: TtIntrinsicEventHandler
  onTransition?: TtIntrinsicEventHandler
  'previous-margin'?: string
  vertical?: boolean
}
