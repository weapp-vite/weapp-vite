// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/button.html
 */
export type WeappIntrinsicElementButton = WeappIntrinsicElementBaseAttributes & {
  'app-parameter'?: string
  bindagreeprivacyauthorization?: WeappIntrinsicEventHandler<unknown>
  bindchooseavatar?: WeappIntrinsicEventHandler<unknown>
  bindcontact?: WeappIntrinsicEventHandler<unknown>
  binderror?: WeappIntrinsicEventHandler<unknown>
  bindgetphonenumber?: WeappIntrinsicEventHandler<unknown>
  bindgetrealtimephonenumber?: WeappIntrinsicEventHandler<unknown>
  bindgetuserinfo?: WeappIntrinsicEventHandler<unknown>
  bindlaunchapp?: WeappIntrinsicEventHandler<unknown>
  bindopensetting?: WeappIntrinsicEventHandler<unknown>
  createliveactivity?: WeappIntrinsicEventHandler<unknown>
  disabled?: boolean
  'entrance-path'?: string
  'form-type'?: 'submit' | 'reset' | 'submitToGroup'
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  lang?: 'en' | 'zh_CN' | 'zh_TW'
  loading?: boolean
  'need-show-entrance'?: boolean
  'open-type'?: 'contact' | 'liveActivity' | 'share' | 'getPhoneNumber' | 'getRealtimePhoneNumber' | 'getUserInfo' | 'launchApp' | 'openSetting' | 'feedback' | 'chooseAvatar' | 'agreePrivacyAuthorization'
  'phone-number-no-quota-toast'?: boolean
  plain?: boolean
  'send-message-img'?: string
  'send-message-path'?: string
  'send-message-title'?: string
  'session-from'?: string
  'show-message-card'?: boolean
  size?: 'default' | 'mini'
  type?: 'primary' | 'default' | 'warn'
}
