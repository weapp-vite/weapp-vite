// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { WeappIntrinsicEventHandler } from '../base'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/page-container.html
 */
export type WeappIntrinsicElementPageContainer = WeappIntrinsicElementBaseAttributes & {
  'close-on-slide-down'?: boolean
  'custom-style'?: string
  duration?: number
  onAfterEnter?: WeappIntrinsicEventHandler
  onAfterLeave?: WeappIntrinsicEventHandler
  onBeforeEnter?: WeappIntrinsicEventHandler
  onBeforeLeave?: WeappIntrinsicEventHandler
  onClickOverlay?: WeappIntrinsicEventHandler
  onEnter?: WeappIntrinsicEventHandler
  onLeave?: WeappIntrinsicEventHandler
  overlay?: boolean
  'overlay-style'?: string
  position?: string
  round?: boolean
  show?: boolean
  'z-index'?: number
}
