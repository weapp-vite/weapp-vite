// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/image
 */
export type AlipayIntrinsicElementImage = AlipayIntrinsicElementBaseAttributes & {
  catchTap?: AlipayIntrinsicEventHandler
  'default-source'?: string
  'lazy-load'?: boolean
  mode?: string
  onError?: AlipayIntrinsicEventHandler
  onLoad?: AlipayIntrinsicEventHandler
  onTap?: AlipayIntrinsicEventHandler
  src?: string
}
