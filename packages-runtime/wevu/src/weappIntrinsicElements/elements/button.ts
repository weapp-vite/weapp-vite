// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/button.html
 */
export type MiniProgramIntrinsicElementButton = MiniProgramIntrinsicElementBaseAttributes & {
  'app-parameter'?: string
  bindagreeprivacyauthorization?: MiniProgramIntrinsicEventHandler<unknown>
  bindchooseavatar?: MiniProgramIntrinsicEventHandler<unknown>
  bindcontact?: MiniProgramIntrinsicEventHandler<unknown>
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindgetphonenumber?: MiniProgramIntrinsicEventHandler<unknown>
  bindgetrealtimephonenumber?: MiniProgramIntrinsicEventHandler<unknown>
  bindgetuserinfo?: MiniProgramIntrinsicEventHandler<unknown>
  bindlaunchapp?: MiniProgramIntrinsicEventHandler<unknown>
  bindopensetting?: MiniProgramIntrinsicEventHandler<unknown>
  createliveactivity?: MiniProgramIntrinsicEventHandler<unknown>
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

export type WeappIntrinsicElementButton = MiniProgramIntrinsicElementButton
