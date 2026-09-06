// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/media-component/image
 */
export type TtIntrinsicElementImage = TtIntrinsicElementBaseAttributes & {
  'lazy-load'?: boolean
  mode?: string
  onError?: WevuJsxEventHandler
  onLoad?: WevuJsxEventHandler
  src?: string
  webp?: boolean
}
