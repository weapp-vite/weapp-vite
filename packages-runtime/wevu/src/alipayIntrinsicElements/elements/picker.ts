// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/picker
 */
export type AlipayIntrinsicElementPicker = AlipayIntrinsicElementBaseAttributes & {
  disabled?: boolean
  onChange?: WevuJsxEventHandler
  range?: Record<string, unknown>[] | string[]
  'range-key'?: string
  title?: string
  value?: number
}
