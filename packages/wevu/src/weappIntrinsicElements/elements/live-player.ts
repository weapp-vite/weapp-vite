// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
 */
export type WeappIntrinsicElementLivePlayer = WeappIntrinsicElementBaseAttributes & {
  'auto-pause-if-navigate'?: boolean
  'auto-pause-if-open-native'?: boolean
  autoplay?: boolean
  'background-mute'?: boolean
  bindaudiovolumenotify?: WeappIntrinsicEventHandler<unknown>
  bindcastinginterrupt?: WeappIntrinsicEventHandler<unknown>
  bindcastingstatechange?: WeappIntrinsicEventHandler<unknown>
  bindcastinguserselect?: WeappIntrinsicEventHandler<unknown>
  bindenterpictureinpicture?: WeappIntrinsicEventHandler<unknown>
  bindfullscreenchange?: WeappIntrinsicEventHandler<unknown>
  bindleavepictureinpicture?: WeappIntrinsicEventHandler<unknown>
  bindnetstatus?: WeappIntrinsicEventHandler<unknown>
  bindstatechange?: WeappIntrinsicEventHandler<unknown>
  'enable-auto-rotation'?: boolean
  'enable-casting'?: boolean
  'max-cache'?: number
  'min-cache'?: number
  mode?: 'live' | 'RTC'
  muted?: boolean
  'object-fit'?: 'contain' | 'fillCrop'
  orientation?: 'vertical' | 'horizontal'
  'picture-in-picture-init-position'?: string
  'picture-in-picture-mode'?: '[]' | 'push' | 'pop'
  'referrer-policy'?: 'origin' | 'no-referrer'
  'sound-mode'?: 'speaker' | 'ear'
  src?: string
}
