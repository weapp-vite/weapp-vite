// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html
 */
export type WeappIntrinsicElementNavigator = WeappIntrinsicElementBaseAttributes & {
  'app-id'?: string
  bindcomplete?: string
  bindfail?: string
  bindsuccess?: string
  delta?: number
  'extra-data'?: Record<string, unknown>
  'hover-class'?: string
  'hover-start-time'?: number
  'hover-stay-time'?: number
  'hover-stop-propagation'?: boolean
  'open-type'?: 'navigate' | 'redirect' | 'switchTab' | 'reLaunch' | 'navigateBack' | 'exit'
  path?: string
  'short-link'?: string
  target?: 'self' | 'miniProgram'
  url?: string
  version?: 'develop' | 'trial' | 'release'
}
