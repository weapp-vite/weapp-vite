/* eslint-disable style/quote-props */
import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from './base'

export interface WeappIntrinsicElementsChunk01PartA {
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
}
