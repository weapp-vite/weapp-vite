// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html
 */
export type WeappIntrinsicElementScrollView = WeappIntrinsicElementBaseAttributes & {
  'associative-container'?: 'draggable-sheet' | 'nested-scroll-view' | 'pop-gesture'
  bounces?: boolean
  'cache-extent'?: number
  clip?: boolean
  'enable-back-to-top'?: boolean
  'enable-flex'?: boolean
  'enable-passive'?: boolean
  enhanced?: boolean
  'fast-deceleration'?: boolean
  'lower-threshold'?: number | string
  'min-drag-distance'?: number
  onDragend?: WevuJsxEventHandler
  onDragging?: WevuJsxEventHandler
  onDragstart?: WevuJsxEventHandler
  onRefresherabort?: WevuJsxEventHandler
  onRefresherpulling?: WevuJsxEventHandler
  onRefresherrefresh?: WevuJsxEventHandler
  onRefresherrestore?: WevuJsxEventHandler
  onRefresherstatuschange?: WevuJsxEventHandler
  onRefresherwillrefresh?: WevuJsxEventHandler
  onScroll?: WevuJsxEventHandler
  onScrollToLower?: WevuJsxEventHandler
  onScrollToUpper?: WevuJsxEventHandler
  onScrollend?: WevuJsxEventHandler
  onScrollstart?: WevuJsxEventHandler
  padding?: unknown[]
  'paging-enabled'?: boolean
  'refresher-background'?: string
  'refresher-ballistic-refresh-enabled'?: boolean
  'refresher-default-style'?: string
  'refresher-enabled'?: boolean
  'refresher-threshold'?: number
  'refresher-triggered'?: boolean
  'refresher-two-level-close-threshold'?: number
  'refresher-two-level-enabled'?: boolean
  'refresher-two-level-pinned'?: boolean
  'refresher-two-level-scroll-enabled'?: boolean
  'refresher-two-level-threshold'?: number
  'refresher-two-level-triggered'?: boolean
  reverse?: boolean
  'scroll-anchoring'?: boolean
  'scroll-into-view'?: string
  'scroll-into-view-alignment'?: 'center' | 'end' | 'nearest' | 'start'
  'scroll-into-view-offset'?: number
  'scroll-into-view-within-extent'?: boolean
  'scroll-left'?: number | string
  'scroll-top'?: number | string
  'scroll-with-animation'?: boolean
  'scroll-x'?: boolean
  'scroll-y'?: boolean
  'show-scrollbar'?: boolean
  type?: 'custom' | 'list' | 'nested'
  'upper-threshold'?: number | string
  'using-sticky'?: boolean
}
