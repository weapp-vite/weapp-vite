// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/rich-text.html
 */
export type WeappIntrinsicElementRichText = WeappIntrinsicElementBaseAttributes & {
  attrs?: Record<string, unknown>
  children?: unknown[]
  mode?: 'aggressive' | 'compat' | 'default' | 'inline-block' | 'web' | 'web-static'
  name?: string
  nodes?: string | unknown[]
  space?: 'emsp' | 'ensp' | 'nbsp'
  text?: string
  'user-select'?: boolean
}
