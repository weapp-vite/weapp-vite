// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/slider.html
 */
export type MiniProgramIntrinsicElementSlider = MiniProgramIntrinsicElementBaseAttributes & {
  activeColor?: string
  backgroundColor?: string
  bindchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindchanging?: MiniProgramIntrinsicEventHandler<unknown>
  'block-color'?: string
  'block-size'?: number
  color?: string
  disabled?: boolean
  max?: number
  min?: number
  'selected-color'?: string
  'show-value'?: boolean
  step?: number
  value?: number
}

export type WeappIntrinsicElementSlider = MiniProgramIntrinsicElementSlider
