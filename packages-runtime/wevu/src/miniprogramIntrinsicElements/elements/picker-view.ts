// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html
 * @see https://opendocs.alipay.com/mini/component/picker-view
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/picker-view
 */
export type MiniProgramIntrinsicElementPickerView = MiniProgramIntrinsicElementBaseAttributes & {
  'immediate-change'?: boolean
  'indicator-class'?: string
  'indicator-style'?: string
  'mask-class'?: string
  'mask-style'?: string
  onChange?: WevuJsxEventHandler
  onPickEnd?: WevuJsxEventHandler
  onPickStart?: WevuJsxEventHandler
}
