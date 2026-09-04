// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html
 * @see https://opendocs.alipay.com/mini/component/web-view
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/open-capacity/web-view
 */
export type MiniProgramIntrinsicElementWebView = MiniProgramIntrinsicElementBaseAttributes & {
  onError?: WevuJsxEventHandler
  onLoad?: WevuJsxEventHandler
  onMessage?: WevuJsxEventHandler
  src?: string
}
