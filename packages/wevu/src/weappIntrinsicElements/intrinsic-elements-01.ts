// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from './base'

export interface WeappIntrinsicElementsGroup01 {
  ad: WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    'unit-id'?: string
  }
  'ad-custom': WeappIntrinsicElementBaseAttributes & {
    'ad-intervals'?: number
    binderror?: WeappIntrinsicEventHandler
    bindload?: WeappIntrinsicEventHandler
    'unit-id'?: string
  }
  audio: WeappIntrinsicElementBaseAttributes & {
    author?: string
    bindended?: WeappIntrinsicEventHandler<unknown>
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindpause?: WeappIntrinsicEventHandler<unknown>
    bindplay?: WeappIntrinsicEventHandler<unknown>
    bindtimeupdate?: WeappIntrinsicEventHandler<unknown>
    controls?: boolean
    id?: string
    loop?: boolean
    name?: string
    poster?: string
    src?: string
  }
  block: WeappIntrinsicElementBaseAttributes
  button: WeappIntrinsicElementBaseAttributes & {
    'app-parameter'?: string
    bindcontact?: WeappIntrinsicEventHandler<unknown>
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindgetphonenumber?: WeappIntrinsicEventHandler<unknown>
    bindgetuserinfo?: WeappIntrinsicEventHandler<unknown>
    bindopensetting?: WeappIntrinsicEventHandler<unknown>
    disabled?: boolean
    'form-type'?: 'submit' | 'reset'
    'hover-class'?: string
    'hover-start-time'?: number
    'hover-stay-time'?: number
    'hover-stop-propagation'?: boolean
    lang?: string
    loading?: boolean
    'open-type'?: 'contact' | 'share' | 'getUserInfo' | 'getPhoneNumber' | 'launchApp' | 'openSetting' | 'feedback'
    plain?: boolean
    'send-message-img'?: string
    'send-message-path'?: string
    'send-message-title'?: string
    'session-from'?: string
    'show-message-card'?: boolean
    size?: 'default' | 'mini'
    type?: 'primary' | 'default' | 'warn'
  }
  camera: WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindscancode?: WeappIntrinsicEventHandler<unknown>
    bindstop?: WeappIntrinsicEventHandler<unknown>
    'device-position'?: string
    flash?: string
    mode?: string
  }
  canvas: WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindlongtap?: WeappIntrinsicEventHandler<unknown>
    bindtouchcancel?: WeappIntrinsicEventHandler<unknown>
    bindtouchend?: WeappIntrinsicEventHandler<unknown>
    bindtouchmove?: WeappIntrinsicEventHandler<unknown>
    bindtouchstart?: WeappIntrinsicEventHandler<unknown>
    'canvas-id'?: string
    'disable-scroll'?: boolean
  }
  checkbox: WeappIntrinsicElementBaseAttributes & {
    checked?: boolean
    color?: string
    disabled?: boolean
    value?: string
  }
  'checkbox-group': WeappIntrinsicElementBaseAttributes & {
    bindchange?: WeappIntrinsicEventHandler<unknown>
  }
  'cover-image': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    src?: string
  }
  'cover-view': WeappIntrinsicElementBaseAttributes & {
    'scroll-top'?: number
  }
  editor: WeappIntrinsicElementBaseAttributes & {
    bindblur?: WeappIntrinsicEventHandler
    bindfocus?: WeappIntrinsicEventHandler
    bindinput?: WeappIntrinsicEventHandler
    bindready?: WeappIntrinsicEventHandler
    bindstatuschange?: WeappIntrinsicEventHandler
    placeholder?: string
    'read-only'?: boolean
    'show-img-resize'?: boolean
    'show-img-size'?: boolean
    'show-img-toolbar'?: boolean
  }
  form: WeappIntrinsicElementBaseAttributes & {
    bindreset?: WeappIntrinsicEventHandler<unknown>
    bindsubmit?: WeappIntrinsicEventHandler<unknown>
    'report-submit'?: boolean
  }
  'functional-page-navigator': WeappIntrinsicElementBaseAttributes & {
    args?: Record<string, unknown>
    bindfail?: WeappIntrinsicEventHandler<unknown>
    bindsuccess?: WeappIntrinsicEventHandler<unknown>
    name?: string
    version?: string
  }
  icon: WeappIntrinsicElementBaseAttributes & {
    color?: string
    size?: number
    type?: string
  }
  image: WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    'lazy-load'?: boolean
    mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
    src?: string
  }
  import: WeappIntrinsicElementBaseAttributes & {
    src?: string
  }
  include: WeappIntrinsicElementBaseAttributes & {
    src?: string
  }
  input: WeappIntrinsicElementBaseAttributes & {
    'adjust-position'?: boolean
    'always-embed'?: boolean
    'auto-focus'?: boolean
    bindblur?: WeappIntrinsicEventHandler<unknown>
    bindconfirm?: WeappIntrinsicEventHandler<unknown>
    bindfocus?: WeappIntrinsicEventHandler<unknown>
    bindinput?: WeappIntrinsicEventHandler<unknown>
    bindkeyboardheightchange?: WeappIntrinsicEventHandler<unknown>
    'confirm-hold'?: boolean
    'confirm-type'?: 'send' | 'search' | 'next' | 'go' | 'done'
    cursor?: number
    'cursor-spacing'?: number
    disabled?: boolean
    focus?: boolean
    'hold-keyboard'?: boolean
    maxlength?: number
    password?: boolean
    placeholder?: string
    'placeholder-class'?: string
    'placeholder-style'?: string
    'safe-password-cert-path'?: string
    'safe-password-custom-hash'?: string
    'safe-password-length'?: number
    'safe-password-nonce'?: string
    'safe-password-salt'?: string
    'safe-password-time-stamp'?: number
    'selection-end'?: number
    'selection-start'?: number
    type?: 'text' | 'number' | 'idcard' | 'digit'
    value?: string
  }
  'keyboard-accessory': WeappIntrinsicElementBaseAttributes
  label: WeappIntrinsicElementBaseAttributes & {
    for?: string
  }
  'live-player': WeappIntrinsicElementBaseAttributes & {
    autoplay?: boolean
    'background-mute'?: boolean
    bindfullscreenchange?: WeappIntrinsicEventHandler<unknown>
    bindnetstatus?: WeappIntrinsicEventHandler<unknown>
    bindstatechange?: WeappIntrinsicEventHandler<unknown>
    'max-cache'?: number
    'min-cache'?: number
    mode?: string
    muted?: boolean
    'object-fit'?: string
    orientation?: string
    src?: string
  }
  'live-pusher': WeappIntrinsicElementBaseAttributes & {
    aspect?: string
    'auto-focus'?: boolean
    autopush?: boolean
    'background-mute'?: boolean
    beauty?: number
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindnetstatus?: WeappIntrinsicEventHandler<unknown>
    bindstatechange?: WeappIntrinsicEventHandler<unknown>
    'device-position'?: string
    'enable-camera'?: boolean
    'max-bitrate'?: number
    'min-bitrate'?: number
    mode?: string
    muted?: boolean
    orientation?: string
    url?: string
    'waiting-image'?: string
    'waiting-image-hash'?: string
    whiteness?: number
    zoom?: boolean
  }
  map: WeappIntrinsicElementBaseAttributes & {
    bindcallouttap?: WeappIntrinsicEventHandler<unknown>
    bindcontroltap?: WeappIntrinsicEventHandler<unknown>
    bindmarkertap?: WeappIntrinsicEventHandler<unknown>
    bindpoitap?: WeappIntrinsicEventHandler<unknown>
    bindregionchange?: WeappIntrinsicEventHandler<unknown>
    bindtap?: WeappIntrinsicEventHandler<unknown>
    bindupdated?: WeappIntrinsicEventHandler<unknown>
    circles?: Record<string, unknown>
    controls?: Record<string, unknown>
    covers?: unknown[]
    'enable-3D'?: boolean
    'enable-overlooking'?: boolean
    'enable-rotate'?: boolean
    'enable-scroll'?: boolean
    'enable-zoom'?: boolean
    'include-points'?: unknown[]
    latitude?: number
    longitude?: number
    markers?: Record<string, unknown>
    polygons?: Record<string, unknown>
    polyline?: Record<string, unknown>
    scale?: number
    'show-compass'?: boolean
    'show-location'?: boolean
    subkey?: string
  }
  'match-media': WeappIntrinsicElementBaseAttributes & {
    height?: number
    'max-height'?: number
    'max-width'?: number
    'min-height'?: number
    'min-width'?: number
    orientation?: string
    width?: number
  }
  'movable-area': WeappIntrinsicElementBaseAttributes & {
    'scale-area'?: boolean
  }
  'movable-view': WeappIntrinsicElementBaseAttributes & {
    animation?: boolean
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindscale?: WeappIntrinsicEventHandler<unknown>
    damping?: number
    direction?: string
    disabled?: boolean
    friction?: number
    htouchmove?: WeappIntrinsicEventHandler<unknown>
    inertia?: boolean
    'out-of-bounds'?: boolean
    scale?: boolean
    'scale-max'?: number
    'scale-min'?: number
    'scale-value'?: number
    vtouchmove?: WeappIntrinsicEventHandler<unknown>
    x?: number | string
    y?: number | string
  }
  'navigation-bar': WeappIntrinsicElementBaseAttributes & {
    'background-color'?: string
    'color-animation-duration'?: number
    'color-animation-timing-func'?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
    'front-color'?: '#ffffff'
    loading?: boolean
    title?: string
  }
  navigator: WeappIntrinsicElementBaseAttributes & {
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
    target?: string
    url?: string
    version?: string
  }
  'official-account': WeappIntrinsicElementBaseAttributes
}
