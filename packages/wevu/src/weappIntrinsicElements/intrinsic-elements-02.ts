// This file is auto-generated from components.json. Do not edit directly.
/* eslint-disable style/quote-props */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from './base'

export interface WeappIntrinsicElementsGroup02 {
  'open-data': WeappIntrinsicElementBaseAttributes & {
    lang?: string
    'open-gid'?: string
    type?: 'groupName' | 'userNickName' | 'userAvatarUrl' | 'userGender' | 'userCity' | 'userProvince' | 'userCountry' | 'userLanguage'
  }
  'page-container': WeappIntrinsicElementBaseAttributes & {
    'bind:afterenter'?: WeappIntrinsicEventHandler
    'bind:afterleave'?: WeappIntrinsicEventHandler
    'bind:beforeenter'?: WeappIntrinsicEventHandler
    'bind:beforeleave'?: WeappIntrinsicEventHandler
    'bind:clickoverlay'?: WeappIntrinsicEventHandler
    'bind:enter'?: WeappIntrinsicEventHandler
    'bind:leave'?: WeappIntrinsicEventHandler
    'close-on-slideDown'?: boolean
    'custom-style'?: string
    duration?: number
    overlay?: boolean
    'overlay-style'?: string
    position?: 'top' | 'bottom' | 'right' | 'center'
    round?: boolean
    show?: boolean
    'z-index'?: number
  }
  'page-meta': WeappIntrinsicElementBaseAttributes & {
    'background-color'?: string
    'background-color-bottom'?: string
    'background-color-top'?: string
    'background-text-style'?: 'dark' | 'light'
    bindresize?: WeappIntrinsicEventHandler
    bindscroll?: WeappIntrinsicEventHandler
    bindscrolldone?: WeappIntrinsicEventHandler
    'page-font-size'?: string
    'page-orientation'?: 'auto' | 'portrait' | 'landscape'
    'page-style'?: string
    'root-background-color'?: string
    'root-font-size'?: string
    'scroll-duration'?: number
    'scroll-top'?: string
  }
  picker: WeappIntrinsicElementBaseAttributes & {
    mode?: string
  }
  'picker-view': WeappIntrinsicElementBaseAttributes & {
    bindchange?: WeappIntrinsicEventHandler<unknown>
    'indicator-class'?: string
    'indicator-style'?: string
    'mask-class'?: string
    'mask-style'?: string
    value?: number[]
  }
  'picker-view-column': WeappIntrinsicElementBaseAttributes
  progress: WeappIntrinsicElementBaseAttributes & {
    active?: boolean
    'active-color'?: string
    'active-mode'?: string
    'background-color'?: string
    color?: string
    percent?: number
    'show-info'?: boolean
    'stroke-width'?: number
  }
  radio: WeappIntrinsicElementBaseAttributes & {
    checked?: boolean
    color?: string
    disabled?: boolean
    value?: string
  }
  'radio-group': WeappIntrinsicElementBaseAttributes & {
    bindchange?: WeappIntrinsicEventHandler<unknown>
  }
  'rich-text': WeappIntrinsicElementBaseAttributes & {
    nodes?: unknown[] | string
  }
  'scroll-view': WeappIntrinsicElementBaseAttributes & {
    bindscroll?: WeappIntrinsicEventHandler<unknown>
    bindscrolltolower?: WeappIntrinsicEventHandler<unknown>
    bindscrolltoupper?: WeappIntrinsicEventHandler<unknown>
    'enable-back-to-top'?: boolean
    'lower-threshold'?: number
    'scroll-into-view'?: string
    'scroll-left'?: number
    'scroll-top'?: number
    'scroll-with-animation'?: boolean
    'scroll-x'?: boolean
    'scroll-y'?: boolean
    'upper-threshold'?: number
  }
  'share-element': WeappIntrinsicElementBaseAttributes & {
    duration?: number
    'easing-function'?: string
    key?: string
    transform?: boolean
  }
  slider: WeappIntrinsicElementBaseAttributes & {
    'active-color'?: string
    'background-color'?: string
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindchanging?: WeappIntrinsicEventHandler<unknown>
    'block-color'?: string
    'block-size'?: number
    color?: string
    disabled?: boolean
    max?: number
    min?: number
    'selected-color'?: string
    'show-value'?: boolean
    step?: number
    value?: number
  }
  slot: WeappIntrinsicElementBaseAttributes & {
    name?: string
  }
  swiper: WeappIntrinsicElementBaseAttributes & {
    autoplay?: boolean
    bindanimationfinish?: WeappIntrinsicEventHandler<unknown>
    bindchange?: WeappIntrinsicEventHandler<unknown>
    circular?: boolean
    current?: number
    'current-item-id'?: string
    'display-multiple-items'?: number
    duration?: number
    'indicator-active-color'?: string
    'indicator-color'?: string
    'indicator-dots'?: boolean
    interval?: number
    'next-margin'?: string
    'previous-margin'?: string
    'skip-hidden-item-layout'?: boolean
    vertical?: boolean
  }
  'swiper-item': WeappIntrinsicElementBaseAttributes & {
    'item-id'?: string
  }
  switch: WeappIntrinsicElementBaseAttributes & {
    bindchange?: WeappIntrinsicEventHandler<unknown>
    checked?: boolean
    color?: string
    disabled?: boolean
    type?: string
  }
  template: WeappIntrinsicElementBaseAttributes & {
    data?: unknown
    is?: string
    name?: string
  }
  text: WeappIntrinsicElementBaseAttributes & {
    decode?: boolean
    selectable?: boolean
    space?: 'ensp' | 'emsp' | 'nbsp'
  }
  textarea: WeappIntrinsicElementBaseAttributes & {
    'adjust-position'?: boolean
    'auto-focus'?: boolean
    'auto-height'?: boolean
    bindblur?: WeappIntrinsicEventHandler<unknown>
    bindconfirm?: WeappIntrinsicEventHandler<unknown>
    bindfocus?: WeappIntrinsicEventHandler<unknown>
    bindinput?: WeappIntrinsicEventHandler<unknown>
    bindkeyboardheightchange?: WeappIntrinsicEventHandler<unknown>
    bindlinechange?: WeappIntrinsicEventHandler<unknown>
    'confirm-hold'?: boolean
    'confirm-type'?: string
    cursor?: number
    'cursor-spacing'?: number
    'disable-default-padding'?: boolean
    disabled?: boolean
    fixed?: boolean
    focus?: boolean
    'hold-keyboard'?: boolean
    maxlength?: number
    placeholder?: string
    'placeholder-class'?: string
    'placeholder-style'?: string
    'selection-end'?: number
    'selection-start'?: number
    'show-confirm-bar'?: boolean
    value?: string
  }
  video: WeappIntrinsicElementBaseAttributes & {
    'ad-unit-id'?: string
    'auto-pause-if-navigate'?: boolean
    'auto-pause-if-open-native'?: boolean
    autoplay?: boolean
    'background-poster'?: string
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
    direction?: number
    duration?: number
    'enable-auto-rotation'?: boolean
    'enable-danmu'?: boolean
    'enable-play-gesture'?: boolean
    'enable-progress-gesture'?: boolean
    'initial-time'?: number
    'is-drm'?: boolean
    'license-url'?: string
    loop?: boolean
    muted?: boolean
    'object-fit'?: string
    'page-gesture'?: boolean
    'picture-in-picture-mode'?: string | unknown[]
    'picture-in-picture-show-progress'?: boolean
    'play-btn-position'?: string
    poster?: string
    'poster-for-crawler'?: string
    'provision-url'?: string
    'referrer-policy'?: string
    'show-background-playback-button'?: boolean
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
  view: WeappIntrinsicElementBaseAttributes & {
    'hover-class'?: string
    'hover-start-time'?: number
    'hover-stay-time'?: number
    'hover-stop-propagation'?: boolean
  }
  'voip-room': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler
    'device-position'?: 'front' | 'back'
    mode?: string
    openid?: string
  }
  'web-view': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    bindmessage?: WeappIntrinsicEventHandler<unknown>
    src?: string
  }
}
