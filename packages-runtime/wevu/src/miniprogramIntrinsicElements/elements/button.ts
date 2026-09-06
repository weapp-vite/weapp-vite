// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/button.html
 * @see https://opendocs.alipay.com/mini/component/button
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/button
 */
export type MiniProgramIntrinsicElementButton = MiniProgramIntrinsicElementBaseAttributes & {
  disabled?: boolean
  'form-type'?: 'reset' | 'submit'
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  loading?: boolean
  onGetPhoneNumber?: WevuJsxEventHandler
  onTap?: WevuJsxEventHandler
  'open-type'?: 'share'
  size?: 'default' | 'mini'
  type?: 'default' | 'primary'
}
