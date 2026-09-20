// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { MiniProgramIntrinsicEventHandler } from '../base'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/textarea.html
 * @see https://opendocs.alipay.com/mini/component/textarea
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/textarea
 */
export type MiniProgramIntrinsicElementTextarea = MiniProgramIntrinsicElementBaseAttributes & {
  'auto-height'?: boolean
  disabled?: boolean
  focus?: boolean
  maxlength?: number
  onBlur?: MiniProgramIntrinsicEventHandler
  onConfirm?: MiniProgramIntrinsicEventHandler
  onFocus?: MiniProgramIntrinsicEventHandler
  onInput?: MiniProgramIntrinsicEventHandler
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  value?: string
}
