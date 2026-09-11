// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/movable-view
 */
export type AlipayIntrinsicElementMovableView = AlipayIntrinsicElementBaseAttributes & {
  animation?: boolean
  catchTouchEnd?: AlipayIntrinsicEventHandler
  catchTouchMove?: AlipayIntrinsicEventHandler
  catchTouchStart?: AlipayIntrinsicEventHandler
  damping?: number
  direction?: string
  disabled?: boolean
  friction?: number
  inertia?: boolean
  onChange?: AlipayIntrinsicEventHandler
  onChangeEnd?: AlipayIntrinsicEventHandler
  onScale?: AlipayIntrinsicEventHandler
  onTouchCancel?: AlipayIntrinsicEventHandler
  onTouchEnd?: AlipayIntrinsicEventHandler
  onTouchMove?: AlipayIntrinsicEventHandler
  onTouchStart?: AlipayIntrinsicEventHandler
  'out-of-bounds'?: boolean
  scale?: boolean
  'scale-max'?: number
  'scale-min'?: number
  'scale-value'?: number
  x?: number
  y?: number
}
