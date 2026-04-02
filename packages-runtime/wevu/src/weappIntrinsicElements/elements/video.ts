// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/video.html
 */
export type WeappIntrinsicElementVideo = WeappIntrinsicElementBaseAttributes & {
  'ad-unit-id'?: string
  'auto-pause-if-navigate'?: boolean
  'auto-pause-if-open-native'?: boolean
  autoplay?: boolean
  'background-poster'?: string
  bindcastinginterrupt?: WeappIntrinsicEventHandler<unknown>
  bindcastingstatechange?: WeappIntrinsicEventHandler<unknown>
  bindcastinguserselect?: WeappIntrinsicEventHandler<unknown>
  bindcontrolstoggle?: WeappIntrinsicEventHandler<unknown>
  bindended?: WeappIntrinsicEventHandler<unknown>
  bindenterpictureinpicture?: WeappIntrinsicEventHandler<unknown>
  binderror?: WeappIntrinsicEventHandler<unknown>
  bindfullscreenchange?: WeappIntrinsicEventHandler<unknown>
  bindleavepictureinpicture?: WeappIntrinsicEventHandler<unknown>
  bindloadedmetadata?: WeappIntrinsicEventHandler<unknown>
  bindpause?: WeappIntrinsicEventHandler<unknown>
  bindplay?: WeappIntrinsicEventHandler<unknown>
  bindprogress?: WeappIntrinsicEventHandler<unknown>
  bindseekcomplete?: WeappIntrinsicEventHandler<unknown>
  bindtimeupdate?: WeappIntrinsicEventHandler<unknown>
  bindwaiting?: WeappIntrinsicEventHandler<unknown>
  'certificate-url'?: string
  controls?: boolean
  'danmu-btn'?: boolean
  'danmu-list'?: Record<string, unknown>[]
  direction?: '0' | '90' | '-90'
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
  'object-fit'?: 'contain' | 'fill' | 'cover'
  'page-gesture'?: boolean
  'picture-in-picture-init-position'?: string
  'picture-in-picture-mode'?: '[]' | 'push' | 'pop'
  'picture-in-picture-show-progress'?: boolean
  'play-btn-position'?: 'bottom' | 'center'
  poster?: string
  'poster-for-crawler'?: string
  'preferred-peak-bit-rate'?: number
  'provision-url'?: string
  'referrer-policy'?: 'origin' | 'no-referrer'
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
