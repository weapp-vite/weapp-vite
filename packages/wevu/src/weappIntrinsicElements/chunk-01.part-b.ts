/* eslint-disable style/quote-props */
import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from './base'

export interface WeappIntrinsicElementsChunk01PartB {
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
}
