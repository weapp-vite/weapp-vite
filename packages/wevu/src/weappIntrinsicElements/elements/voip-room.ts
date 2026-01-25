// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html
 */
export type WeappIntrinsicElementVoipRoom = WeappIntrinsicElementBaseAttributes & {
  binderror?: WeappIntrinsicEventHandler<unknown>
  'device-position'?: 'front' | 'back'
  mode?: 'camera' | 'video'
  'object-fit'?: 'fill' | 'contain' | 'cover'
  openid?: string
}
