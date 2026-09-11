// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { WeappIntrinsicEventHandler } from '../base'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html
 */
export type WeappIntrinsicElementWebView = WeappIntrinsicElementBaseAttributes & {
  onError?: WeappIntrinsicEventHandler
  onLoad?: WeappIntrinsicEventHandler
  onMessage?: WeappIntrinsicEventHandler
  src?: string
}
