// 此文件由 components.json 自动生成，请勿直接修改。

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/audio.html
 */
export type WeappIntrinsicElementAudio = WeappIntrinsicElementBaseAttributes & {
  author?: string
  bindended?: WeappIntrinsicEventHandler<unknown>
  binderror?: WeappIntrinsicEventHandler<unknown>
  bindpause?: WeappIntrinsicEventHandler<unknown>
  bindplay?: WeappIntrinsicEventHandler<unknown>
  bindtimeupdate?: WeappIntrinsicEventHandler<unknown>
  controls?: boolean
  loop?: boolean
  name?: string
  poster?: string
  src?: string
}
