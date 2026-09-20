// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/web-view
 */
export type AlipayIntrinsicElementWebView = AlipayIntrinsicElementBaseAttributes & {
  onError?: AlipayIntrinsicEventHandler
  onLoad?: AlipayIntrinsicEventHandler
  onMessage?: AlipayIntrinsicEventHandler
  src?: string
}
