// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/camera.html
 * @see https://opendocs.alipay.com/mini/03qegu
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/media-component/camera
 */
export type MiniProgramIntrinsicElementCamera = MiniProgramIntrinsicElementBaseAttributes & {
  'device-position'?: 'back' | 'front'
  flash?: 'auto' | 'off' | 'on' | 'torch'
  'frame-size'?: 'large' | 'medium' | 'small'
  mode?: 'normal' | 'scanCode'
  onError?: WevuJsxEventHandler
  onScanCode?: WevuJsxEventHandler
  onStop?: WevuJsxEventHandler
}
