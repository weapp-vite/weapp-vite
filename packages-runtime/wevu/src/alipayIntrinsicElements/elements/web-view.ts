// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/web-view
 */
export type AlipayIntrinsicElementWebView = AlipayIntrinsicElementBaseAttributes & {
  onError?: WevuJsxEventHandler
  onLoad?: WevuJsxEventHandler
  onMessage?: WevuJsxEventHandler
  src?: string
}
