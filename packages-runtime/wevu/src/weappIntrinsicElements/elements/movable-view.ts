// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html
 */
export type WeappIntrinsicElementMovableView = WeappIntrinsicElementBaseAttributes & {
  animation?: boolean
  bindchange?: WeappIntrinsicEventHandler<unknown>
  bindscale?: WeappIntrinsicEventHandler<unknown>
  damping?: number
  direction?: string
  disabled?: boolean
  friction?: number
  htouchmove?: WeappIntrinsicEventHandler<unknown>
  inertia?: boolean
  'out-of-bounds'?: boolean
  scale?: boolean
  'scale-max'?: number
  'scale-min'?: number
  'scale-value'?: number
  vtouchmove?: WeappIntrinsicEventHandler<unknown>
  x?: number | string
  y?: number | string
}
