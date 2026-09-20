// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html
 * @see https://opendocs.alipay.com/mini/component/movable-view
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/view-container/movable-view
 */
export type MiniProgramIntrinsicElementMovableView = MiniProgramIntrinsicElementBaseAttributes & {
  animation?: boolean
  damping?: number
  direction?: string
  disabled?: boolean
  friction?: number
  inertia?: boolean
  onChange?: WevuJsxEventHandler
  onScale?: WevuJsxEventHandler
  'out-of-bounds'?: boolean
  scale?: boolean
  'scale-max'?: number
  'scale-min'?: number
  'scale-value'?: number
  x?: number
  y?: number
}
