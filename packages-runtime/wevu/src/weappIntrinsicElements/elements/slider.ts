// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/slider.html
 */
export type WeappIntrinsicElementSlider = WeappIntrinsicElementBaseAttributes & {
  activeColor?: string
  backgroundColor?: string
  'block-color'?: string
  'block-size'?: number
  color?: string
  disabled?: boolean
  max?: number
  min?: number
  onChange?: WevuJsxEventHandler
  onChanging?: WevuJsxEventHandler
  'selected-color'?: string
  'show-value'?: boolean
  step?: number
  value?: number
}
