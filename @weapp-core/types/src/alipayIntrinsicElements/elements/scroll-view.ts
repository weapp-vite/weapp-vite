// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/scroll-view
 */
export type AlipayIntrinsicElementScrollView = AlipayIntrinsicElementBaseAttributes & {
  'disable-lower-scroll'?: string
  'disable-upper-scroll'?: string
  'enable-back-to-top'?: boolean
  'lower-threshold'?: number
  onScroll?: AlipayIntrinsicEventHandler
  onScrollToLower?: AlipayIntrinsicEventHandler
  onScrollToUpper?: AlipayIntrinsicEventHandler
  onTouchCancel?: AlipayIntrinsicEventHandler
  onTouchEnd?: AlipayIntrinsicEventHandler
  onTouchMove?: AlipayIntrinsicEventHandler
  onTouchStart?: AlipayIntrinsicEventHandler
  'scroll-animation-duration'?: number
  'scroll-into-view'?: string
  'scroll-left'?: number
  'scroll-top'?: number
  'scroll-with-animation'?: boolean
  'scroll-x'?: boolean
  'scroll-y'?: boolean
  'trap-scroll'?: boolean
  'upper-threshold'?: number
}
