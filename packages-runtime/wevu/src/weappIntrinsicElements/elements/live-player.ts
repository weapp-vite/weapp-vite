// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
 */
export type MiniProgramIntrinsicElementLivePlayer = MiniProgramIntrinsicElementBaseAttributes & {
  'auto-pause-if-navigate'?: boolean
  'auto-pause-if-open-native'?: boolean
  autoplay?: boolean
  'background-mute'?: boolean
  bindaudiovolumenotify?: MiniProgramIntrinsicEventHandler<unknown>
  bindcastinginterrupt?: MiniProgramIntrinsicEventHandler<unknown>
  bindcastingstatechange?: MiniProgramIntrinsicEventHandler<unknown>
  bindcastinguserselect?: MiniProgramIntrinsicEventHandler<unknown>
  bindenterpictureinpicture?: MiniProgramIntrinsicEventHandler<unknown>
  bindfullscreenchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindleavepictureinpicture?: MiniProgramIntrinsicEventHandler<unknown>
  bindnetstatus?: MiniProgramIntrinsicEventHandler<unknown>
  bindstatechange?: MiniProgramIntrinsicEventHandler<unknown>
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

export type WeappIntrinsicElementLivePlayer = MiniProgramIntrinsicElementLivePlayer
