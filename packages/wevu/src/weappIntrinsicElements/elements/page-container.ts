// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/page-container.html
 */
export type WeappIntrinsicElementPageContainer = WeappIntrinsicElementBaseAttributes & {
  'bind:afterenter'?: WeappIntrinsicEventHandler<unknown>
  'bind:afterleave'?: WeappIntrinsicEventHandler<unknown>
  'bind:beforeenter'?: WeappIntrinsicEventHandler<unknown>
  'bind:beforeleave'?: WeappIntrinsicEventHandler<unknown>
  'bind:clickoverlay'?: WeappIntrinsicEventHandler<unknown>
  'bind:enter'?: WeappIntrinsicEventHandler<unknown>
  'bind:leave'?: WeappIntrinsicEventHandler<unknown>
  'close-on-slide-down'?: boolean
  'custom-style'?: string
  duration?: number
  overlay?: boolean
  'overlay-style'?: string
  position?: string
  round?: boolean
  show?: boolean
  'z-index'?: number
}
