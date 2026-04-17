// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/audio.html
 */
export type MiniProgramIntrinsicElementAudio = MiniProgramIntrinsicElementBaseAttributes & {
  author?: string
  bindended?: MiniProgramIntrinsicEventHandler<unknown>
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindpause?: MiniProgramIntrinsicEventHandler<unknown>
  bindplay?: MiniProgramIntrinsicEventHandler<unknown>
  bindtimeupdate?: MiniProgramIntrinsicEventHandler<unknown>
  controls?: boolean
  loop?: boolean
  name?: string
  poster?: string
  src?: string
}

export type WeappIntrinsicElementAudio = MiniProgramIntrinsicElementAudio
