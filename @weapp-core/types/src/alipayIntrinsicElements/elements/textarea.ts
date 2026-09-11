// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/textarea
 */
export type AlipayIntrinsicElementTextarea = AlipayIntrinsicElementBaseAttributes & {
  'auto-height'?: boolean
  controlled?: boolean
  disabled?: boolean
  focus?: boolean
  maxlength?: number
  name?: string
  onBlur?: AlipayIntrinsicEventHandler
  onConfirm?: AlipayIntrinsicEventHandler
  onFocus?: AlipayIntrinsicEventHandler
  onInput?: AlipayIntrinsicEventHandler
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'show-count'?: boolean
  value?: string
}
