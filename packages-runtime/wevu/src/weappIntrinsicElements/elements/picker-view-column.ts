// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html
 */
export type MiniProgramIntrinsicElementPickerViewColumn = MiniProgramIntrinsicElementBaseAttributes & {
  bindchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindpickend?: MiniProgramIntrinsicEventHandler<unknown>
  bindpickstart?: MiniProgramIntrinsicEventHandler<unknown>
  'immediate-change'?: boolean
  'indicator-class'?: string
  'indicator-style'?: string
  'mask-class'?: string
  'mask-style'?: string
  value?: number[]
}

export type WeappIntrinsicElementPickerViewColumn = MiniProgramIntrinsicElementPickerViewColumn
