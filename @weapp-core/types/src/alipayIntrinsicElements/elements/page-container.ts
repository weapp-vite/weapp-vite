// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/04ne6j
 */
export type AlipayIntrinsicElementPageContainer = AlipayIntrinsicElementBaseAttributes & {
  'close-on-slide-down'?: boolean
  'custom-style'?: string
  duration?: number
  onAfterEnter?: AlipayIntrinsicEventHandler
  onAfterLeave?: AlipayIntrinsicEventHandler
  onBeforeEnter?: AlipayIntrinsicEventHandler
  onBeforeLeave?: AlipayIntrinsicEventHandler
  onClickOverlay?: AlipayIntrinsicEventHandler
  onEnter?: AlipayIntrinsicEventHandler
  onEnterCancelled?: AlipayIntrinsicEventHandler
  onLeave?: AlipayIntrinsicEventHandler
  onLeaveCancelled?: AlipayIntrinsicEventHandler
  overlay?: boolean
  'overlay-style'?: string
  position?: string
  round?: boolean
  show?: boolean
  'z-index'?: number
}
