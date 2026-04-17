// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/video.html
 */
export type MiniProgramIntrinsicElementVideo = MiniProgramIntrinsicElementBaseAttributes & {
  'ad-unit-id'?: string
  'auto-pause-if-navigate'?: boolean
  'auto-pause-if-open-native'?: boolean
  autoplay?: boolean
  'background-poster'?: string
  bindcastinginterrupt?: MiniProgramIntrinsicEventHandler<unknown>
  bindcastingstatechange?: MiniProgramIntrinsicEventHandler<unknown>
  bindcastinguserselect?: MiniProgramIntrinsicEventHandler<unknown>
  bindcontrolstoggle?: MiniProgramIntrinsicEventHandler<unknown>
  bindended?: MiniProgramIntrinsicEventHandler<unknown>
  bindenterpictureinpicture?: MiniProgramIntrinsicEventHandler<unknown>
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindfullscreenchange?: MiniProgramIntrinsicEventHandler<unknown>
  bindleavepictureinpicture?: MiniProgramIntrinsicEventHandler<unknown>
  bindloadedmetadata?: MiniProgramIntrinsicEventHandler<unknown>
  bindpause?: MiniProgramIntrinsicEventHandler<unknown>
  bindplay?: MiniProgramIntrinsicEventHandler<unknown>
  bindprogress?: MiniProgramIntrinsicEventHandler<unknown>
  bindseekcomplete?: MiniProgramIntrinsicEventHandler<unknown>
  bindtimeupdate?: MiniProgramIntrinsicEventHandler<unknown>
  bindwaiting?: MiniProgramIntrinsicEventHandler<unknown>
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

export type WeappIntrinsicElementVideo = MiniProgramIntrinsicElementVideo
