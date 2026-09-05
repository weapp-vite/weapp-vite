// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html
 */
export type WeappIntrinsicElementLivePusher = WeappIntrinsicElementBaseAttributes & {
  aspect?: string
  'audio-quality'?: string
  'audio-reverb-type'?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
  'audio-volume-type'?: 'auto' | 'media' | 'voicecall'
  'auto-focus'?: boolean
  autopush?: boolean
  'background-mute'?: boolean
  beauty?: number
  'beauty-style'?: 'nature' | 'smooth'
  'custom-effect'?: boolean
  'device-position'?: string
  'enable-agc'?: boolean
  'enable-ans'?: boolean
  'enable-camera'?: boolean
  'enable-mic'?: boolean
  enableVideoCustomRender?: boolean
  'eye-bigness'?: number
  'face-thinness'?: number
  filter?: 'aestheticism' | 'blues' | 'cerisered' | 'cool' | 'fresher' | 'nostalgia' | 'pink' | 'romantic' | 'solor' | 'standard' | 'whitening'
  fps?: number
  'local-mirror'?: 'auto' | 'disable' | 'enable'
  'max-bitrate'?: number
  'min-bitrate'?: number
  mirror?: boolean
  mode?: 'FHD' | 'HD' | 'HVGA' | 'QVGA' | 'RTC' | 'SD'
  muted?: boolean
  onAudiovolumenotify?: WevuJsxEventHandler
  onBgmcomplete?: WevuJsxEventHandler
  onBgmprogress?: WevuJsxEventHandler
  onBgmstart?: WevuJsxEventHandler
  onEnterpictureinpicture?: WevuJsxEventHandler
  onError?: WevuJsxEventHandler
  onLeavepictureinpicture?: WevuJsxEventHandler
  onNetstatus?: WevuJsxEventHandler
  onStatechange?: WevuJsxEventHandler
  orientation?: 'horizontal' | 'vertical'
  'picture-in-picture-mode'?: '[]' | 'pop' | 'push'
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
