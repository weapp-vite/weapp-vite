// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/video.html
 */
export type WeappIntrinsicElementVideo = WeappIntrinsicElementBaseAttributes & {
  'ad-unit-id'?: string
  'auto-pause-if-navigate'?: boolean
  'auto-pause-if-open-native'?: boolean
  autoplay?: boolean
  'background-poster'?: string
  'certificate-url'?: string
  controls?: boolean
  'danmu-btn'?: boolean
  'danmu-list'?: Record<string, unknown>[]
  direction?: '-90' | '0' | '90'
  duration?: number
  'enable-auto-rotation'?: boolean
  'enable-danmu'?: boolean
  'enable-play-gesture'?: boolean
  'enable-progress-gesture'?: boolean
  'initial-time'?: number
  'is-drm'?: boolean
  'is-live'?: boolean
  'license-url'?: string
  loop?: boolean
  muted?: boolean
  'object-fit'?: 'contain' | 'cover' | 'fill'
  onCastinginterrupt?: WevuJsxEventHandler
  onCastingstatechange?: WevuJsxEventHandler
  onCastinguserselect?: WevuJsxEventHandler
  onControlstoggle?: WevuJsxEventHandler
  onEnded?: WevuJsxEventHandler
  onEnterpictureinpicture?: WevuJsxEventHandler
  onError?: WevuJsxEventHandler
  onFullScreenChange?: WevuJsxEventHandler
  onLeavepictureinpicture?: WevuJsxEventHandler
  onLoadedmetadata?: WevuJsxEventHandler
  onPause?: WevuJsxEventHandler
  onPlay?: WevuJsxEventHandler
  onProgress?: WevuJsxEventHandler
  onSeekcomplete?: WevuJsxEventHandler
  onTimeUpdate?: WevuJsxEventHandler
  onWaiting?: WevuJsxEventHandler
  'page-gesture'?: boolean
  'picture-in-picture-init-position'?: string
  'picture-in-picture-mode'?: '[]' | 'pop' | 'push'
  'picture-in-picture-show-progress'?: boolean
  'play-btn-position'?: 'bottom' | 'center'
  poster?: string
  'poster-for-crawler'?: string
  'preferred-peak-bit-rate'?: number
  'provision-url'?: string
  'referrer-policy'?: 'no-referrer' | 'origin'
  'show-background-playback-button'?: boolean
  'show-bottom-progress'?: boolean
  'show-casting-button'?: boolean
  'show-center-play-btn'?: boolean
  'show-fullscreen-btn'?: boolean
  'show-mute-btn'?: boolean
  'show-play-btn'?: boolean
  'show-progress'?: boolean
  'show-screen-lock-button'?: boolean
  'show-snapshot-button'?: boolean
  src?: string
  title?: string
  'vslide-gesture'?: boolean
  'vslide-gesture-in-fullscreen'?: boolean
}
