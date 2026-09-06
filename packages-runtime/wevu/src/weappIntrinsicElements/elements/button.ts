// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/button.html
 */
export type WeappIntrinsicElementButton = WeappIntrinsicElementBaseAttributes & {
  'app-parameter'?: string
  disabled?: boolean
  'entrance-path'?: string
  'form-type'?: 'reset' | 'submit' | 'submitToGroup'
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  lang?: 'en' | 'zh_CN' | 'zh_TW'
  loading?: boolean
  'need-show-entrance'?: boolean
  onAgreePrivacyAuthorization?: WevuJsxEventHandler
  onChooseAvatar?: WevuJsxEventHandler
  onContact?: WevuJsxEventHandler
  onCreateLiveActivity?: WevuJsxEventHandler
  onError?: WevuJsxEventHandler
  onGetPhoneNumber?: WevuJsxEventHandler
  onGetRealtimePhoneNumber?: WevuJsxEventHandler
  onGetUserInfo?: WevuJsxEventHandler
  onLaunchApp?: WevuJsxEventHandler
  onOpenSetting?: WevuJsxEventHandler
  onTap?: WevuJsxEventHandler
  'open-type'?: 'agreePrivacyAuthorization' | 'chooseAvatar' | 'contact' | 'feedback' | 'getPhoneNumber' | 'getRealtimePhoneNumber' | 'getUserInfo' | 'launchApp' | 'liveActivity' | 'openSetting' | 'share'
  'phone-number-no-quota-toast'?: boolean
  plain?: boolean
  'send-message-img'?: string
  'send-message-path'?: string
  'send-message-title'?: string
  'session-from'?: string
  'show-message-card'?: boolean
  size?: 'default' | 'mini'
  type?: 'default' | 'primary' | 'warn'
}
