// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/list/button
 */
export type TtIntrinsicElementButton = TtIntrinsicElementBaseAttributes & {
  disabled?: boolean
  'form-type'?: 'reset' | 'submit'
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  loading?: boolean
  onAgreePrivacyAuthorization?: WevuJsxEventHandler
  onGetPhoneNumber?: WevuJsxEventHandler
  onTap?: WevuJsxEventHandler
  'open-type'?: 'addCalendarEvent' | 'addShortcut' | 'agreePrivacyAuthorization' | 'authorizePrivateMessage' | 'getPhoneNumber' | 'im' | 'joinGroup' | 'navigateToVideoView' | 'openAwemeUserProfile' | 'openSubscribeMessageSetting' | 'openWebcastRoom' | 'platformIm' | 'privateMessage' | 'share' | 'uploadDouyinVideo'
  size?: 'default' | 'mini'
  type?: 'default' | 'primary'
}
