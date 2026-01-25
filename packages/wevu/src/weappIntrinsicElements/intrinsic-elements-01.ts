// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from './base'

export interface WeappIntrinsicElementsGroup01 {
  ad: WeappIntrinsicElementBaseAttributes & {
    'ad-intervals'?: number
    'ad-theme'?: string
    'ad-type'?: string
    bindclose?: WeappIntrinsicEventHandler<unknown>
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    'unit-id'?: string
  }
  'ad-custom': WeappIntrinsicElementBaseAttributes & {
    'ad-intervals'?: number
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
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
    bindagreeprivacyauthorization?: WeappIntrinsicEventHandler<unknown>
    bindchooseavatar?: WeappIntrinsicEventHandler<unknown>
    bindcontact?: WeappIntrinsicEventHandler<unknown>
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindgetphonenumber?: WeappIntrinsicEventHandler<unknown>
    bindgetrealtimephonenumber?: WeappIntrinsicEventHandler<unknown>
    bindgetuserinfo?: WeappIntrinsicEventHandler<unknown>
    bindlaunchapp?: WeappIntrinsicEventHandler<unknown>
    bindopensetting?: WeappIntrinsicEventHandler<unknown>
    createliveactivity?: WeappIntrinsicEventHandler<unknown>
    disabled?: boolean
    'entrance-path'?: string
    'form-type'?: 'submit' | 'reset' | 'submitToGroup'
    'hover-class'?: string
    'hover-start-time'?: number
    'hover-stay-time'?: number
    'hover-stop-propagation'?: boolean
    lang?: 'en' | 'zh_CN' | 'zh_TW'
    loading?: boolean
    'need-show-entrance'?: boolean
    'open-type'?: 'contact' | 'liveActivity' | 'share' | 'getPhoneNumber' | 'getRealtimePhoneNumber' | 'getUserInfo' | 'launchApp' | 'openSetting' | 'feedback' | 'chooseAvatar' | 'agreePrivacyAuthorization'
    'phone-number-no-quota-toast'?: boolean
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
    bindinitdone?: WeappIntrinsicEventHandler<unknown>
    bindscancode?: WeappIntrinsicEventHandler<unknown>
    bindstop?: WeappIntrinsicEventHandler<unknown>
    'device-position'?: 'front' | 'back'
    flash?: 'auto' | 'on' | 'off' | 'torch'
    'frame-size'?: 'small' | 'medium' | 'large'
    mode?: 'normal' | 'scanCode'
    resolution?: 'low' | 'medium' | 'high'
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
    type?: string
  }
  checkbox: WeappIntrinsicElementBaseAttributes & {
    checked?: boolean
    color?: string
    disabled?: boolean
    value?: string
  }
  'checkbox-group': WeappIntrinsicElementBaseAttributes & {
    checked?: boolean
    color?: string
    disabled?: boolean
    value?: string
  }
  'cover-image': WeappIntrinsicElementBaseAttributes & {
    'scroll-top'?: number | string
  }
  'cover-view': WeappIntrinsicElementBaseAttributes & {
    'scroll-top'?: number | string
  }
  editor: WeappIntrinsicElementBaseAttributes & {
    bindblur?: WeappIntrinsicEventHandler<unknown>
    bindfocus?: WeappIntrinsicEventHandler<unknown>
    bindinput?: WeappIntrinsicEventHandler<unknown>
    bindready?: WeappIntrinsicEventHandler<unknown>
    bindstatuschange?: WeappIntrinsicEventHandler<unknown>
    'confirm-hold'?: boolean
    'enable-formats'?: string[]
    enterkeyhint?: string
    placeholder?: string
    'read-only'?: boolean
    'show-img-resize'?: boolean
    'show-img-size'?: boolean
    'show-img-toolbar'?: boolean
  }
  form: WeappIntrinsicElementBaseAttributes & {
    bindreset?: WeappIntrinsicEventHandler<unknown>
    bindsubmit?: WeappIntrinsicEventHandler<unknown>
    bindsubmitToGroup?: WeappIntrinsicEventHandler<unknown>
    name?: string
    'report-submit'?: boolean
    'report-submit-timeout'?: number
    value?: unknown
  }
  'functional-page-navigator': WeappIntrinsicElementBaseAttributes & {
    args?: Record<string, unknown>
    bindcancel?: WeappIntrinsicEventHandler<unknown>
    bindfail?: WeappIntrinsicEventHandler<unknown>
    bindsuccess?: WeappIntrinsicEventHandler<unknown>
    name?: 'loginAndGetUserInfo' | 'requestPayment' | 'chooseAddress' | 'chooseInvoice' | 'chooseInvoiceTitle'
    version?: 'develop' | 'trial' | 'release'
  }
  icon: WeappIntrinsicElementBaseAttributes & {
    color?: string
    size?: number | string
    type?: string
  }
  image: WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    'fade-in'?: boolean
    forceHttps?: boolean
    'lazy-load'?: boolean
    mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
    'show-menu-by-longpress'?: boolean
    src?: string
    webp?: boolean
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
    'bind:keyboardcompositionend'?: WeappIntrinsicEventHandler<unknown>
    'bind:keyboardcompositionstart'?: WeappIntrinsicEventHandler<unknown>
    'bind:keyboardcompositionupdate'?: WeappIntrinsicEventHandler<unknown>
    'bind:selectionchange'?: WeappIntrinsicEventHandler<unknown>
    bindblur?: WeappIntrinsicEventHandler<unknown>
    bindchange?: WeappIntrinsicEventHandler<unknown>
    bindconfirm?: WeappIntrinsicEventHandler<unknown>
    bindfocus?: WeappIntrinsicEventHandler<unknown>
    bindinput?: WeappIntrinsicEventHandler<unknown>
    bindkeyboardheightchange?: WeappIntrinsicEventHandler<unknown>
    bindnicknamereview?: WeappIntrinsicEventHandler<unknown>
    'confirm-hold'?: boolean
    'confirm-type'?: 'send' | 'search' | 'next' | 'go' | 'done'
    cursor?: number
    'cursor-color'?: string
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
    type?: 'text' | 'number' | 'idcard' | 'digit' | 'safe-password' | 'nickname'
    value?: string
    'worklet:onkeyboardheightchange'?: WeappIntrinsicEventHandler<unknown>
  }
  'keyboard-accessory': WeappIntrinsicElementBaseAttributes
  label: WeappIntrinsicElementBaseAttributes & {
    for?: string
  }
  'live-player': WeappIntrinsicElementBaseAttributes & {
    'auto-pause-if-navigate'?: boolean
    'auto-pause-if-open-native'?: boolean
    autoplay?: boolean
    'background-mute'?: boolean
    bindaudiovolumenotify?: WeappIntrinsicEventHandler<unknown>
    bindcastinginterrupt?: WeappIntrinsicEventHandler<unknown>
    bindcastingstatechange?: WeappIntrinsicEventHandler<unknown>
    bindcastinguserselect?: WeappIntrinsicEventHandler<unknown>
    bindenterpictureinpicture?: WeappIntrinsicEventHandler<unknown>
    bindfullscreenchange?: WeappIntrinsicEventHandler<unknown>
    bindleavepictureinpicture?: WeappIntrinsicEventHandler<unknown>
    bindnetstatus?: WeappIntrinsicEventHandler<unknown>
    bindstatechange?: WeappIntrinsicEventHandler<unknown>
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
  'live-pusher': WeappIntrinsicElementBaseAttributes & {
    aspect?: string
    'audio-quality'?: string
    'audio-reverb-type'?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
    'audio-volume-type'?: 'auto' | 'media' | 'voicecall'
    'auto-focus'?: boolean
    autopush?: boolean
    'background-mute'?: boolean
    beauty?: number
    'beauty-style'?: 'smooth' | 'nature'
    bindaudiovolumenotify?: WeappIntrinsicEventHandler<unknown>
    bindbgmcomplete?: WeappIntrinsicEventHandler<unknown>
    bindbgmprogress?: WeappIntrinsicEventHandler<unknown>
    bindbgmstart?: WeappIntrinsicEventHandler<unknown>
    bindenterpictureinpicture?: WeappIntrinsicEventHandler<unknown>
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindleavepictureinpicture?: WeappIntrinsicEventHandler<unknown>
    bindnetstatus?: WeappIntrinsicEventHandler<unknown>
    bindstatechange?: WeappIntrinsicEventHandler<unknown>
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
  map: WeappIntrinsicElementBaseAttributes & {
    alpha?: number
    anchor?: Record<string, unknown>
    anchorX?: number
    anchorY?: number
    'aria-label'?: string
    arrowIconPath?: string
    arrowLine?: boolean
    bgColor?: string
    bindabilityfail?: WeappIntrinsicEventHandler<unknown>
    bindabilitysuccess?: WeappIntrinsicEventHandler<unknown>
    bindauthsuccess?: WeappIntrinsicEventHandler<unknown>
    bindcallouttap?: WeappIntrinsicEventHandler<unknown>
    bindcontroltap?: WeappIntrinsicEventHandler<unknown>
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindinterpolatepoint?: WeappIntrinsicEventHandler<unknown>
    bindlabeltap?: WeappIntrinsicEventHandler<unknown>
    bindmarkertap?: WeappIntrinsicEventHandler<unknown>
    bindpoitap?: WeappIntrinsicEventHandler<unknown>
    bindpolylinetap?: WeappIntrinsicEventHandler<unknown>
    bindregionchange?: WeappIntrinsicEventHandler<unknown>
    bindtap?: WeappIntrinsicEventHandler<unknown>
    bindupdated?: WeappIntrinsicEventHandler<unknown>
    borderColor?: string
    borderRadius?: number
    borderWidth?: number
    callout?: Record<string, unknown>
    causedBy?: string
    circles?: unknown[]
    clickable?: boolean
    clusterId?: number
    collision?: string
    collisionRelation?: string
    color?: string
    colorList?: unknown[]
    content?: string
    controls?: unknown[]
    covers?: unknown[]
    customCallout?: Record<string, unknown>
    dashArray?: number[]
    display?: string
    dottedLine?: boolean
    'enable-3D'?: boolean
    'enable-auto-max-overlooking'?: boolean
    'enable-building'?: boolean
    'enable-overlooking'?: boolean
    'enable-poi'?: boolean
    'enable-rotate'?: boolean
    'enable-satellite'?: boolean
    'enable-scroll'?: boolean
    'enable-traffic'?: boolean
    'enable-zoom'?: boolean
    endIndex?: number
    fillColor?: string
    fontSize?: number
    height?: number
    iconPath?: string
    id?: number
    'include-points'?: unknown[]
    joinCluster?: boolean
    label?: Record<string, unknown>
    latitude?: number
    'layer-style'?: number
    left?: number
    level?: string
    longitude?: number
    markers?: unknown[]
    'max-scale'?: number
    'min-scale'?: number
    name?: string
    padding?: number
    points?: unknown[]
    polygons?: unknown[]
    polyline?: unknown[]
    position?: Record<string, unknown>
    radius?: number
    rotate?: number
    scale?: number
    segmentTexts?: Record<string, unknown>[]
    setting?: Record<string, unknown>
    'show-compass'?: boolean
    'show-location'?: boolean
    'show-scale'?: boolean
    skew?: number
    startIndex?: number
    strokeColor?: string
    strokeWidth?: number
    subkey?: string
    textAlign?: string
    textColor?: string
    textStyle?: Record<string, unknown>
    title?: string
    top?: number
    type?: string
    width?: number
    x?: number
    y?: number
    zIndex?: number
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
    'color-animation-timing-func'?: string
    'front-color'?: string
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
    target?: 'self' | 'miniProgram'
    url?: string
    version?: 'develop' | 'trial' | 'release'
  }
  'official-account': WeappIntrinsicElementBaseAttributes & {
    binderror?: WeappIntrinsicEventHandler<unknown>
    bindload?: WeappIntrinsicEventHandler<unknown>
    errMsg?: string
    status?: number
  }
}
