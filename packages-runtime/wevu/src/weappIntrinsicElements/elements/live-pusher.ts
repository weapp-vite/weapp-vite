// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html
 */
export type MiniProgramIntrinsicElementLivePusher = MiniProgramIntrinsicElementBaseAttributes & {
  aspect?: string
  'audio-quality'?: string
  'audio-reverb-type'?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
  'audio-volume-type'?: 'auto' | 'media' | 'voicecall'
  'auto-focus'?: boolean
  autopush?: boolean
  'background-mute'?: boolean
  beauty?: number
  'beauty-style'?: 'smooth' | 'nature'
  bindaudiovolumenotify?: MiniProgramIntrinsicEventHandler<unknown>
  bindbgmcomplete?: MiniProgramIntrinsicEventHandler<unknown>
  bindbgmprogress?: MiniProgramIntrinsicEventHandler<unknown>
  bindbgmstart?: MiniProgramIntrinsicEventHandler<unknown>
  bindenterpictureinpicture?: MiniProgramIntrinsicEventHandler<unknown>
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindleavepictureinpicture?: MiniProgramIntrinsicEventHandler<unknown>
  bindnetstatus?: MiniProgramIntrinsicEventHandler<unknown>
  bindstatechange?: MiniProgramIntrinsicEventHandler<unknown>
  'custom-effect'?: boolean
  'device-position'?: string
  'enable-agc'?: boolean
  'enable-ans'?: boolean
  'enable-camera'?: boolean
  'enable-mic'?: boolean
  enableVideoCustomRender?: boolean
  'eye-bigness'?: number
  'face-thinness'?: number
  filter?: 'standard' | 'pink' | 'nostalgia' | 'blues' | 'romantic' | 'cool' | 'fresher' | 'solor' | 'aestheticism' | 'whitening' | 'cerisered'
  fps?: number
  'local-mirror'?: 'auto' | 'enable' | 'disable'
  'max-bitrate'?: number
  'min-bitrate'?: number
  mirror?: boolean
  mode?: 'QVGA' | 'HVGA' | 'SD' | 'HD' | 'FHD' | 'RTC'
  muted?: boolean
  orientation?: 'vertical' | 'horizontal'
  'picture-in-picture-mode'?: '[]' | 'push' | 'pop'
  'remote-mirror'?: boolean
  'skin-smoothness'?: number
  'skin-whiteness'?: number
  url?: string
  'video-height'?: number
  'video-width'?: number
  'voice-changer-type'?: number
  'waiting-image'?: string
  'waiting-image-hash'?: string
  whiteness?: number
  zoom?: boolean
}

export type WeappIntrinsicElementLivePusher = MiniProgramIntrinsicElementLivePusher
