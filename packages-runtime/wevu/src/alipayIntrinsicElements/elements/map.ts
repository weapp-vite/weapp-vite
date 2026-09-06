// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { WevuJsxEventHandler } from '../../jsx-runtime'
import type { AlipayIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://opendocs.alipay.com/mini/component/map
 */
export type AlipayIntrinsicElementMap = AlipayIntrinsicElementBaseAttributes & {
  circles?: unknown[]
  controls?: unknown[]
  'custom-map-style'?: string
  'enable-building'?: boolean
  'enable-overlooking'?: boolean
  'enable-poi'?: boolean
  'enable-rotate'?: boolean
  'enable-satellite'?: boolean
  'enable-scroll'?: boolean
  'enable-traffic'?: boolean
  'enable-zoom'?: boolean
  'ground-overlays'?: unknown[]
  'include-padding'?: Record<string, unknown>
  'include-points'?: unknown[]
  latitude?: number
  longitude?: number
  markers?: unknown[]
  onCalloutTap?: WevuJsxEventHandler
  onControlTap?: WevuJsxEventHandler
  onInitComplete?: WevuJsxEventHandler
  onMarkerTap?: WevuJsxEventHandler
  onPanelTap?: WevuJsxEventHandler
  onRegionChange?: WevuJsxEventHandler
  onTap?: WevuJsxEventHandler
  panels?: unknown[]
  polygon?: unknown[]
  polyline?: unknown[]
  rotate?: number
  scale?: number
  setting?: Record<string, unknown>
  'show-compass'?: boolean
  'show-location'?: boolean
  'show-scale'?: boolean
  skew?: number
  'tile-overlay'?: Record<string, unknown>
}
