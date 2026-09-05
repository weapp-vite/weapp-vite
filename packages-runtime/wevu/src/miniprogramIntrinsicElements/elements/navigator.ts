// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html
 * @see https://opendocs.alipay.com/mini/component/navigator
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/navigation/navigator
 */
export type MiniProgramIntrinsicElementNavigator = MiniProgramIntrinsicElementBaseAttributes & {
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'open-type'?: 'exit' | 'navigate' | 'navigateBack' | 'reLaunch' | 'redirect' | 'switchTab'
  url?: string
}
