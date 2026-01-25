// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/rich-text.html
 */
export type WeappIntrinsicElementRichText = WeappIntrinsicElementBaseAttributes & {
  attrs?: Record<string, unknown>
  children?: unknown[]
  mode?: 'default' | 'compat' | 'aggressive' | 'inline-block' | 'web' | 'web-static'
  name?: string
  nodes?: unknown[] | string
  space?: 'ensp' | 'emsp' | 'nbsp'
  text?: string
  'user-select'?: boolean
}
