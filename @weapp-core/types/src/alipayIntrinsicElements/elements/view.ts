// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/view
 */
export type AlipayIntrinsicElementView = AlipayIntrinsicElementBaseAttributes & {
  animation?: Record<string, unknown>
  'disable-scroll'?: boolean
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  onAnimationEnd?: AlipayIntrinsicEventHandler
  onAnimationIteration?: AlipayIntrinsicEventHandler
  onAnimationStart?: AlipayIntrinsicEventHandler
  onAppear?: AlipayIntrinsicEventHandler
  onDisappear?: AlipayIntrinsicEventHandler
  onFirstAppear?: AlipayIntrinsicEventHandler
  onLongTap?: AlipayIntrinsicEventHandler
  onTap?: AlipayIntrinsicEventHandler
  onTouchCancel?: AlipayIntrinsicEventHandler
  onTouchEnd?: AlipayIntrinsicEventHandler
  onTouchMove?: AlipayIntrinsicEventHandler
  onTouchStart?: AlipayIntrinsicEventHandler
  onTransitionEnd?: AlipayIntrinsicEventHandler
  role?: unknown
}
