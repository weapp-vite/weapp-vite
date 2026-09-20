// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/audio.html
 */
export type WeappIntrinsicElementAudio = WeappIntrinsicElementBaseAttributes & {
  author?: string
  controls?: boolean
  loop?: boolean
  name?: string
  onEnded?: WevuJsxEventHandler
  onError?: WevuJsxEventHandler
  onPause?: WevuJsxEventHandler
  onPlay?: WevuJsxEventHandler
  onTimeUpdate?: WevuJsxEventHandler
  poster?: string
  src?: string
}
