// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
 */
export type WeappIntrinsicElementLivePlayer = WeappIntrinsicElementBaseAttributes & {
  'auto-pause-if-navigate'?: boolean
  'auto-pause-if-open-native'?: boolean
  autoplay?: boolean
  'background-mute'?: boolean
  'enable-auto-rotation'?: boolean
  'enable-casting'?: boolean
  'max-cache'?: number
  'min-cache'?: number
  mode?: 'RTC' | 'live'
  muted?: boolean
  'object-fit'?: 'contain' | 'fillCrop'
  onAudiovolumenotify?: WevuJsxEventHandler
  onCastinginterrupt?: WevuJsxEventHandler
  onCastingstatechange?: WevuJsxEventHandler
  onCastinguserselect?: WevuJsxEventHandler
  onEnterpictureinpicture?: WevuJsxEventHandler
  onFullScreenChange?: WevuJsxEventHandler
  onLeavepictureinpicture?: WevuJsxEventHandler
  onNetstatus?: WevuJsxEventHandler
  onStatechange?: WevuJsxEventHandler
  orientation?: 'horizontal' | 'vertical'
  'picture-in-picture-init-position'?: string
  'picture-in-picture-mode'?: '[]' | 'pop' | 'push'
  'referrer-policy'?: 'no-referrer' | 'origin'
  'sound-mode'?: 'ear' | 'speaker'
  src?: string
}
