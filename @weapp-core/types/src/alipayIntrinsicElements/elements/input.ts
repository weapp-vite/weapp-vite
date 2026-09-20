// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/input
 */
export type AlipayIntrinsicElementInput = AlipayIntrinsicElementBaseAttributes & {
  'always-system'?: boolean
  'confirm-hold'?: boolean
  'confirm-type'?: 'done' | 'go' | 'next' | 'search' | 'send'
  controlled?: boolean
  cursor?: number
  disabled?: boolean
  focus?: boolean
  maxlength?: number
  name?: string
  onBlur?: AlipayIntrinsicEventHandler
  onConfirm?: AlipayIntrinsicEventHandler
  onFocus?: AlipayIntrinsicEventHandler
  onInput?: AlipayIntrinsicEventHandler
  password?: boolean
  placeholder?: string
  'placeholder-class'?: string
  'placeholder-style'?: string
  'random-number'?: boolean
  'selection-end'?: number
  'selection-start'?: number
  type?: 'digit' | 'digitpad' | 'idcard' | 'idcardpad' | 'nickname' | 'number' | 'numberpad' | 'text'
  value?: string
}
