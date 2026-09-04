// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { WeappIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/image.html
 */
export type WeappIntrinsicElementImage = WeappIntrinsicElementBaseAttributes & {
  'fade-in'?: boolean
  forceHttps?: boolean
  'lazy-load'?: boolean
  mode?: 'aspectFill' | 'aspectFit' | 'bottom' | 'bottom left' | 'bottom right' | 'center' | 'heightFix' | 'left' | 'right' | 'scaleToFill' | 'top' | 'top left' | 'top right' | 'widthFix'
  onError?: WevuJsxEventHandler
  onLoad?: WevuJsxEventHandler
  'show-menu-by-longpress'?: boolean
  src?: string
  webp?: boolean
}
