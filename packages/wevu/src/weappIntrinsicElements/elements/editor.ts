// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/editor.html
 */
export type WeappIntrinsicElementEditor = WeappIntrinsicElementBaseAttributes & {
  bindblur?: WeappIntrinsicEventHandler<unknown>
  bindfocus?: WeappIntrinsicEventHandler<unknown>
  bindinput?: WeappIntrinsicEventHandler<unknown>
  bindready?: WeappIntrinsicEventHandler<unknown>
  bindstatuschange?: WeappIntrinsicEventHandler<unknown>
  'confirm-hold'?: boolean
  'enable-formats'?: string[]
  enterkeyhint?: string
  placeholder?: string
  'read-only'?: boolean
  'show-img-resize'?: boolean
  'show-img-size'?: boolean
  'show-img-toolbar'?: boolean
}
