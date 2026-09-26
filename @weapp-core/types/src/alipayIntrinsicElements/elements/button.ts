// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */
/* eslint-disable import/no-duplicates -- 生成器按类型职责拆分导入。 */

import type { AlipayIntrinsicEventHandler } from '../base'
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
  onChooseAvatar?: AlipayIntrinsicEventHandler
  onError?: AlipayIntrinsicEventHandler
  onFollowLifestyle?: AlipayIntrinsicEventHandler
  onGetAuthorize?: AlipayIntrinsicEventHandler
  onGetPhoneNumber?: AlipayIntrinsicEventHandler
  onGetUserInfo?: AlipayIntrinsicEventHandler
  onTap?: AlipayIntrinsicEventHandler
  'open-type'?: 'chooseAvatar' | 'contactShare' | 'getAuthorize' | 'lifestyle' | 'share'
  plain?: boolean
  'public-id'?: string
  scope?: 'phoneNumber'
  size?: 'default' | 'mini'
  type?: 'default' | 'primary' | 'warn'
}
