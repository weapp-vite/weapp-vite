// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { TtIntrinsicEventHandler } from '../base'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/view-container/scroll-view
 */
export type TtIntrinsicElementScrollView = TtIntrinsicElementBaseAttributes & {
  bounces?: boolean
  enhanced?: boolean
  'lower-threshold'?: number
  onRefresherabort?: TtIntrinsicEventHandler
  onRefresherpulling?: TtIntrinsicEventHandler
  onRefresherrefresh?: TtIntrinsicEventHandler
  onRefresherrestore?: TtIntrinsicEventHandler
  onScroll?: TtIntrinsicEventHandler
  onScrollToLower?: TtIntrinsicEventHandler
  onScrollToUpper?: TtIntrinsicEventHandler
  'refresher-background'?: string
  'refresher-default-style'?: string
  'refresher-enabled'?: boolean
  'refresher-threshold'?: number
  'refresher-triggered'?: boolean
  'scroll-into-view'?: string
  'scroll-left'?: number
  'scroll-top'?: number
  'scroll-with-animation'?: boolean
  'scroll-x'?: boolean
  'scroll-y'?: boolean
  'upper-threshold'?: number
}
