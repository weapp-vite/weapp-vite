// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { TtIntrinsicEventHandler } from '../base'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/media-component/camera
 */
export type TtIntrinsicElementCamera = TtIntrinsicElementBaseAttributes & {
  'device-position'?: string
  flash?: string
  'frame-size'?: string
  mode?: string
  onError?: TtIntrinsicEventHandler
  onInitdone?: TtIntrinsicEventHandler
  onScanCode?: TtIntrinsicEventHandler
  onStop?: TtIntrinsicEventHandler
  resolution?: string
}
