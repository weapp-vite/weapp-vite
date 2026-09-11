// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/video
 */
export type AlipayIntrinsicElementVideo = AlipayIntrinsicElementBaseAttributes & {
  autoplay?: boolean
  controls?: boolean
  direction?: number
  duration?: number
  'enable-progress-gesture'?: boolean
  'floating-mode'?: string
  'initial-time'?: number
  loop?: boolean
  'mobilenet-hint-type'?: number
  muted?: boolean
  'object-fit'?: string
  onEnded?: AlipayIntrinsicEventHandler
  onError?: AlipayIntrinsicEventHandler
  onFullScreenChange?: AlipayIntrinsicEventHandler
  onLoading?: AlipayIntrinsicEventHandler
  onPause?: AlipayIntrinsicEventHandler
  onPlay?: AlipayIntrinsicEventHandler
  onRenderStart?: AlipayIntrinsicEventHandler
  onStop?: AlipayIntrinsicEventHandler
  onTap?: AlipayIntrinsicEventHandler
  onTimeUpdate?: AlipayIntrinsicEventHandler
  onUserAction?: AlipayIntrinsicEventHandler
  poster?: string
  'poster-size'?: string
  'show-center-play-btn'?: boolean
  'show-fullscreen-btn'?: boolean
  'show-mute-btn'?: boolean
  'show-play-btn'?: boolean
  'show-thin-progress-bar'?: boolean
  src?: string
}
