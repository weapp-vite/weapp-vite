// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html
 */
export type MiniProgramIntrinsicElementScrollView = MiniProgramIntrinsicElementBaseAttributes & {
  'associative-container'?: 'draggable-sheet' | 'nested-scroll-view' | 'pop-gesture'
  'bind:refresherstatuschange'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:refresherwillrefresh'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:scroll'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:scrollend'?: MiniProgramIntrinsicEventHandler<unknown>
  'bind:scrollstart'?: MiniProgramIntrinsicEventHandler<unknown>
  binddragend?: MiniProgramIntrinsicEventHandler<unknown>
  binddragging?: MiniProgramIntrinsicEventHandler<unknown>
  binddragstart?: MiniProgramIntrinsicEventHandler<unknown>
  bindrefresherabort?: MiniProgramIntrinsicEventHandler<unknown>
  bindrefresherpulling?: MiniProgramIntrinsicEventHandler<unknown>
  bindrefresherrefresh?: MiniProgramIntrinsicEventHandler<unknown>
  bindrefresherrestore?: MiniProgramIntrinsicEventHandler<unknown>
  bindscroll?: MiniProgramIntrinsicEventHandler<unknown>
  bindscrolltolower?: MiniProgramIntrinsicEventHandler<unknown>
  bindscrolltoupper?: MiniProgramIntrinsicEventHandler<unknown>
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
  'scroll-into-view-alignment'?: 'start' | 'center' | 'end' | 'nearest'
  'scroll-into-view-offset'?: number
  'scroll-into-view-within-extent'?: boolean
  'scroll-left'?: number | string
  'scroll-top'?: number | string
  'scroll-with-animation'?: boolean
  'scroll-x'?: boolean
  'scroll-y'?: boolean
  'show-scrollbar'?: boolean
  type?: 'list' | 'custom' | 'nested'
  'upper-threshold'?: number | string
  'using-sticky'?: boolean
  'worklet:adjust-deceleration-velocity'?: MiniProgramIntrinsicEventHandler<unknown>
  'worklet:onscrollend'?: MiniProgramIntrinsicEventHandler<unknown>
  'worklet:onscrollstart'?: MiniProgramIntrinsicEventHandler<unknown>
  'worklet:onscrollupdate'?: MiniProgramIntrinsicEventHandler<unknown>
}

export type WeappIntrinsicElementScrollView = MiniProgramIntrinsicElementScrollView
