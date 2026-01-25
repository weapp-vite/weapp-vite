// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from './base'

export interface WeappIntrinsicElementsGroup02 {
  'open-data': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    'default-avatar'?: string
    'default-text'?: string
    lang?: 'en' | 'zh_CN' | 'zh_TW'
    'open-gid'?: string
    type?: 'groupName'
  }
  'page-container': WeappIntrinsicElementBaseAttributes & {
    'bind:afterenter'?: WeappIntrinsicEventHandler<unknown>
    'bind:afterleave'?: WeappIntrinsicEventHandler<unknown>
    'bind:beforeenter'?: WeappIntrinsicEventHandler<unknown>
    'bind:beforeleave'?: WeappIntrinsicEventHandler<unknown>
    'bind:clickoverlay'?: WeappIntrinsicEventHandler<unknown>
    'bind:enter'?: WeappIntrinsicEventHandler<unknown>
    'bind:leave'?: WeappIntrinsicEventHandler<unknown>
    'close-on-slide-down'?: boolean
    'custom-style'?: string
    duration?: number
    overlay?: boolean
    'overlay-style'?: string
    position?: string
    round?: boolean
    show?: boolean
    'z-index'?: number
  }
  'page-meta': WeappIntrinsicElementBaseAttributes & {
    'background-color'?: string
    'background-color-bottom'?: string
    'background-color-top'?: string
    'background-text-style'?: string
    bindresize?: WeappIntrinsicEventHandler<unknown>
    bindscroll?: WeappIntrinsicEventHandler<unknown>
    bindscrolldone?: WeappIntrinsicEventHandler<unknown>
    'page-font-size'?: string
    'page-orientation'?: string
    'page-style'?: string
    'root-background-color'?: string
    'root-font-size'?: string
    'scroll-duration'?: number
    'scroll-top'?: string
  }
  picker: WeappIntrinsicElementBaseAttributes & {
    bindcancel?: WeappIntrinsicEventHandler<unknown>
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindcolumnchange?: WeappIntrinsicEventHandler<unknown>
    'custom-item'?: string
    disabled?: boolean
    end?: string
    fields?: string
    'header-text'?: string
    level?: string
    mode?: 'selector' | 'multiSelector' | 'time' | 'date' | 'region'
    range?: unknown[] | Record<string, unknown>[]
    'range-key'?: string
    start?: string
    value?: unknown[]
  }
  'picker-view': WeappIntrinsicElementBaseAttributes & {
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindpickend?: WeappIntrinsicEventHandler<unknown>
    bindpickstart?: WeappIntrinsicEventHandler<unknown>
    'immediate-change'?: boolean
    'indicator-class'?: string
    'indicator-style'?: string
    'mask-class'?: string
    'mask-style'?: string
    value?: number[]
  }
  'picker-view-column': WeappIntrinsicElementBaseAttributes & {
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindpickend?: WeappIntrinsicEventHandler<unknown>
    bindpickstart?: WeappIntrinsicEventHandler<unknown>
    'immediate-change'?: boolean
    'indicator-class'?: string
    'indicator-style'?: string
    'mask-class'?: string
    'mask-style'?: string
    value?: number[]
  }
  progress: WeappIntrinsicElementBaseAttributes & {
    active?: boolean
    'active-mode'?: string
    activeColor?: string
    backgroundColor?: string
    bindactiveend?: WeappIntrinsicEventHandler<unknown>
    'border-radius'?: number | string
    color?: string
    duration?: number
    'font-size'?: number | string
    percent?: number
    'show-info'?: boolean
    'stroke-width'?: number | string
  }
  radio: WeappIntrinsicElementBaseAttributes & {
    checked?: boolean
    color?: string
    disabled?: boolean
    value?: string
  }
  'radio-group': WeappIntrinsicElementBaseAttributes & {
    checked?: boolean
    color?: string
    disabled?: boolean
    value?: string
  }
  'rich-text': WeappIntrinsicElementBaseAttributes & {
    attrs?: Record<string, unknown>
    children?: unknown[]
    mode?: 'default' | 'compat' | 'aggressive' | 'inline-block' | 'web' | 'web-static'
    name?: string
    nodes?: unknown[] | string
    space?: 'ensp' | 'emsp' | 'nbsp'
    text?: string
    'user-select'?: boolean
  }
  'scroll-view': WeappIntrinsicElementBaseAttributes & {
    'associative-container'?: 'draggable-sheet' | 'nested-scroll-view' | 'pop-gesture'
    'bind:refresherstatuschange'?: WeappIntrinsicEventHandler<unknown>
    'bind:refresherwillrefresh'?: WeappIntrinsicEventHandler<unknown>
    'bind:scroll'?: WeappIntrinsicEventHandler<unknown>
    'bind:scrollend'?: WeappIntrinsicEventHandler<unknown>
    'bind:scrollstart'?: WeappIntrinsicEventHandler<unknown>
    binddragend?: WeappIntrinsicEventHandler<unknown>
    binddragging?: WeappIntrinsicEventHandler<unknown>
    binddragstart?: WeappIntrinsicEventHandler<unknown>
    bindrefresherabort?: WeappIntrinsicEventHandler<unknown>
    bindrefresherpulling?: WeappIntrinsicEventHandler<unknown>
    bindrefresherrefresh?: WeappIntrinsicEventHandler<unknown>
    bindrefresherrestore?: WeappIntrinsicEventHandler<unknown>
    bindscroll?: WeappIntrinsicEventHandler<unknown>
    bindscrolltolower?: WeappIntrinsicEventHandler<unknown>
    bindscrolltoupper?: WeappIntrinsicEventHandler<unknown>
    bounces?: boolean
    'cache-extent'?: number
    clip?: boolean
    'enable-back-to-top'?: boolean
    'enable-flex'?: boolean
    'enable-passive'?: boolean
    enhanced?: boolean
    'fast-deceleration'?: boolean
    'lower-threshold'?: number | string
    'min-drag-distance'?: number
    padding?: unknown[]
    'paging-enabled'?: boolean
    'refresher-background'?: string
    'refresher-ballistic-refresh-enabled'?: boolean
    'refresher-default-style'?: string
    'refresher-enabled'?: boolean
    'refresher-threshold'?: number
    'refresher-triggered'?: boolean
    'refresher-two-level-close-threshold'?: number
    'refresher-two-level-enabled'?: boolean
    'refresher-two-level-pinned'?: boolean
    'refresher-two-level-scroll-enabled'?: boolean
    'refresher-two-level-threshold'?: number
    'refresher-two-level-triggered'?: boolean
    reverse?: boolean
    'scroll-anchoring'?: boolean
    'scroll-into-view'?: string
    'scroll-into-view-alignment'?: 'start' | 'center' | 'end' | 'nearest'
    'scroll-into-view-offset'?: number
    'scroll-into-view-within-extent'?: boolean
    'scroll-left'?: number | string
    'scroll-top'?: number | string
    'scroll-with-animation'?: boolean
    'scroll-x'?: boolean
    'scroll-y'?: boolean
    'show-scrollbar'?: boolean
    type?: 'list' | 'custom' | 'nested'
    'upper-threshold'?: number | string
    'using-sticky'?: boolean
    'worklet:adjust-deceleration-velocity'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollend'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollstart'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollupdate'?: WeappIntrinsicEventHandler<unknown>
  }
  'share-element': WeappIntrinsicElementBaseAttributes & {
    duration?: number
    'easing-function'?: string
    key?: string
    'rect-tween-type'?: 'materialRectArc' | 'materialRectCenterArc' | 'linear' | 'elasticIn' | 'elasticOut' | 'elasticInOut' | 'bounceIn' | 'bounceOut' | 'bounceInOut' | 'cubic-bezier(x1, y1, x2, y2'
    'shuttle-on-pop'?: string
    'shuttle-on-push'?: 'from' | 'to'
    transform?: boolean
    'transition-on-gesture'?: boolean
    'worklet:onframe'?: WeappIntrinsicEventHandler<unknown>
  }
  slider: WeappIntrinsicElementBaseAttributes & {
    activeColor?: string
    backgroundColor?: string
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
    bindtransition?: WeappIntrinsicEventHandler<unknown>
    'cache-extent'?: number
    circular?: boolean
    current?: number
    direction?: 'all' | 'positive' | 'negative'
    'display-multiple-items'?: number
    duration?: number
    'easing-function'?: 'default' | 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
    'indicator-active-color'?: string
    'indicator-alignment'?: number[] | string
    'indicator-color'?: string
    'indicator-dots'?: boolean
    'indicator-height'?: number
    'indicator-margin'?: number
    'indicator-offset'?: number[]
    'indicator-radius'?: number
    'indicator-spacing'?: number
    'indicator-type'?: 'normal' | 'worm' | 'wormThin' | 'wormUnderground' | 'wormThinUnderground' | 'expand' | 'jump' | 'jumpWithOffset' | 'scroll' | 'scrollFixedCenter' | 'slide' | 'slideUnderground' | 'scale' | 'swap' | 'swapYRotation' | 'color'
    'indicator-width'?: number
    interval?: number
    'layout-type'?: 'normal' | 'stackLeft' | 'stackRight' | 'tinder' | 'transformer'
    'next-margin'?: string
    'previous-margin'?: string
    'scroll-with-animation'?: boolean
    'snap-to-edge'?: boolean
    'transformer-type'?: 'scaleAndFade' | 'accordion' | 'threeD' | 'zoomIn' | 'zoomOut' | 'deepthPage'
    vertical?: boolean
    'worklet:onscrollend'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollstart'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollupdate'?: WeappIntrinsicEventHandler<unknown>
  }
  'swiper-item': WeappIntrinsicElementBaseAttributes & {
    autoplay?: boolean
    bindanimationfinish?: WeappIntrinsicEventHandler<unknown>
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindtransition?: WeappIntrinsicEventHandler<unknown>
    'cache-extent'?: number
    circular?: boolean
    current?: number
    direction?: 'all' | 'positive' | 'negative'
    'display-multiple-items'?: number
    duration?: number
    'easing-function'?: 'default' | 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
    'indicator-active-color'?: string
    'indicator-alignment'?: number[] | string
    'indicator-color'?: string
    'indicator-dots'?: boolean
    'indicator-height'?: number
    'indicator-margin'?: number
    'indicator-offset'?: number[]
    'indicator-radius'?: number
    'indicator-spacing'?: number
    'indicator-type'?: 'normal' | 'worm' | 'wormThin' | 'wormUnderground' | 'wormThinUnderground' | 'expand' | 'jump' | 'jumpWithOffset' | 'scroll' | 'scrollFixedCenter' | 'slide' | 'slideUnderground' | 'scale' | 'swap' | 'swapYRotation' | 'color'
    'indicator-width'?: number
    interval?: number
    'layout-type'?: 'normal' | 'stackLeft' | 'stackRight' | 'tinder' | 'transformer'
    'next-margin'?: string
    'previous-margin'?: string
    'scroll-with-animation'?: boolean
    'snap-to-edge'?: boolean
    'transformer-type'?: 'scaleAndFade' | 'accordion' | 'threeD' | 'zoomIn' | 'zoomOut' | 'deepthPage'
    vertical?: boolean
    'worklet:onscrollend'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollstart'?: WeappIntrinsicEventHandler<unknown>
    'worklet:onscrollupdate'?: WeappIntrinsicEventHandler<unknown>
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
    'max-lines'?: number
    overflow?: 'clip' | 'fade' | 'ellipsis' | 'visible'
    selectable?: boolean
    space?: 'ensp' | 'emsp' | 'nbsp'
    'user-select'?: boolean
  }
  textarea: WeappIntrinsicElementBaseAttributes & {
    'adjust-keyboard-to'?: 'cursor' | 'bottom'
    'adjust-position'?: boolean
    'auto-focus'?: boolean
    'auto-height'?: boolean
    'bind:keyboardcompositionend'?: WeappIntrinsicEventHandler<unknown>
    'bind:keyboardcompositionstart'?: WeappIntrinsicEventHandler<unknown>
    'bind:keyboardcompositionupdate'?: WeappIntrinsicEventHandler<unknown>
    'bind:selectionchange'?: WeappIntrinsicEventHandler<unknown>
    bindblur?: WeappIntrinsicEventHandler<unknown>
    bindconfirm?: WeappIntrinsicEventHandler<unknown>
    bindfocus?: WeappIntrinsicEventHandler<unknown>
    bindinput?: WeappIntrinsicEventHandler<unknown>
    bindkeyboardheightchange?: WeappIntrinsicEventHandler<unknown>
    bindlinechange?: WeappIntrinsicEventHandler<unknown>
    'confirm-hold'?: boolean
    'confirm-type'?: 'send' | 'search' | 'next' | 'go' | 'done' | 'return'
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
  view: WeappIntrinsicElementBaseAttributes & {
    'hover-class'?: string
    'hover-start-time'?: number
    'hover-stay-time'?: number
    'hover-stop-propagation'?: boolean
  }
  'voip-room': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    'device-position'?: 'front' | 'back'
    mode?: 'camera' | 'video'
    'object-fit'?: 'fill' | 'contain' | 'cover'
    openid?: string
  }
  'web-view': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    bindmessage?: WeappIntrinsicEventHandler<unknown>
    src?: string
  }
}
