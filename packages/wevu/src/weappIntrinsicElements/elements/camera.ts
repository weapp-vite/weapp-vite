// 此文件由 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WeappIntrinsicElementBaseAttributes, WeappIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/camera.html
 */
export type WeappIntrinsicElementCamera = WeappIntrinsicElementBaseAttributes & {
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
