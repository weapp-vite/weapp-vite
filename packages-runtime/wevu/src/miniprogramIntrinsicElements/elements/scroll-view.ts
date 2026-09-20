// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html
 * @see https://opendocs.alipay.com/mini/component/scroll-view
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/view-container/scroll-view
 */
export type MiniProgramIntrinsicElementScrollView = MiniProgramIntrinsicElementBaseAttributes & {
  'lower-threshold'?: number
  onScroll?: WevuJsxEventHandler
  onScrollToLower?: WevuJsxEventHandler
  onScrollToUpper?: WevuJsxEventHandler
  'scroll-into-view'?: string
  'scroll-left'?: number
  'scroll-top'?: number
  'scroll-with-animation'?: boolean
  'scroll-x'?: boolean
  'scroll-y'?: boolean
  'upper-threshold'?: number
}
