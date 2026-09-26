// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { WeappIntrinsicEventHandler } from '../base'
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
  onChange?: WeappIntrinsicEventHandler
  onChanging?: WeappIntrinsicEventHandler
  'selected-color'?: string
  'show-value'?: boolean
  step?: number
  value?: number
}
