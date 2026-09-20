// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/progress.html
 */
export type WeappIntrinsicElementProgress = WeappIntrinsicElementBaseAttributes & {
  active?: boolean
  'active-mode'?: string
  activeColor?: string
  backgroundColor?: string
  'border-radius'?: number | string
  color?: string
  duration?: number
  'font-size'?: number | string
  onActiveend?: WevuJsxEventHandler
  percent?: number
  'show-info'?: boolean
  'stroke-width'?: number | string
}
