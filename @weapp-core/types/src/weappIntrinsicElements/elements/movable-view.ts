// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { WeappIntrinsicEventHandler } from '../base'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html
 */
export type WeappIntrinsicElementMovableView = WeappIntrinsicElementBaseAttributes & {
  animation?: boolean
  damping?: number
  direction?: string
  disabled?: boolean
  friction?: number
  inertia?: boolean
  onChange?: WeappIntrinsicEventHandler
  onHtouchmove?: WeappIntrinsicEventHandler
  onScale?: WeappIntrinsicEventHandler
  onVtouchmove?: WeappIntrinsicEventHandler
  'out-of-bounds'?: boolean
  scale?: boolean
  'scale-max'?: number
  'scale-min'?: number
  'scale-value'?: number
  x?: number | string
  y?: number | string
}
