// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/view-container/movable-view
 */
export type TtIntrinsicElementMovableView = TtIntrinsicElementBaseAttributes & {
  animation?: boolean
  damping?: number
  direction?: string
  disabled?: boolean
  friction?: number
  inertia?: boolean
  onChange?: WevuJsxEventHandler
  onHtouchmove?: WevuJsxEventHandler
  onScale?: WevuJsxEventHandler
  onVtouchmove?: WevuJsxEventHandler
  'out-of-bounds'?: boolean
  scale?: boolean
  'scale-max'?: number
  'scale-min'?: number
  'scale-value'?: number
  x?: number | string
  y?: number | string
}
