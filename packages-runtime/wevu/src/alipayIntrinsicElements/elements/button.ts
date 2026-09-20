// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/button
 */
export type AlipayIntrinsicElementButton = AlipayIntrinsicElementBaseAttributes & {
  disabled?: boolean
  'form-type'?: 'reset' | 'submit'
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  loading?: boolean
  onChooseAvatar?: WevuJsxEventHandler
  onError?: WevuJsxEventHandler
  onFollowLifestyle?: WevuJsxEventHandler
  onGetAuthorize?: WevuJsxEventHandler
  onGetPhoneNumber?: WevuJsxEventHandler
  onGetUserInfo?: WevuJsxEventHandler
  onTap?: WevuJsxEventHandler
  'open-type'?: 'chooseAvatar' | 'contactShare' | 'getAuthorize' | 'lifestyle' | 'share'
  plain?: boolean
  'public-id'?: string
  scope?: 'phoneNumber'
  size?: 'default' | 'mini'
  type?: 'default' | 'primary' | 'warn'
}
