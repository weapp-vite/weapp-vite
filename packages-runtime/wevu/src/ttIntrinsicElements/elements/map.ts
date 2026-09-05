// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { TtIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/map/map
 */
export type TtIntrinsicElementMap = TtIntrinsicElementBaseAttributes & {
  'enable-3D'?: boolean
  'enable-building'?: boolean
  'enable-overlooking'?: boolean
  'enable-poi'?: boolean
  'enable-rotate'?: boolean
  'enable-satellite'?: boolean
  'enable-scroll'?: boolean
  'enable-traffic'?: boolean
  'enable-zoom'?: boolean
  latitude?: number
  longitude?: number
  'max-scale'?: number
  'min-scale'?: number
  onAnchorpointtap?: WevuJsxEventHandler
  onCalloutTap?: WevuJsxEventHandler
  onLabeltap?: WevuJsxEventHandler
  onMarkerTap?: WevuJsxEventHandler
  onRegionChange?: WevuJsxEventHandler
  onTap?: WevuJsxEventHandler
  onUpdated?: WevuJsxEventHandler
  rotate?: number
  scale?: number
  'show-compass'?: boolean
  'show-location'?: boolean
  'show-scale'?: boolean
  skew?: number
}
