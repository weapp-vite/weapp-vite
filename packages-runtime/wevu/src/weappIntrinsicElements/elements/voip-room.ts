// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html
 */
export type MiniProgramIntrinsicElementVoipRoom = MiniProgramIntrinsicElementBaseAttributes & {
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  'device-position'?: 'front' | 'back'
  mode?: 'camera' | 'video'
  'object-fit'?: 'fill' | 'contain' | 'cover'
  openid?: string
}

export type WeappIntrinsicElementVoipRoom = MiniProgramIntrinsicElementVoipRoom
