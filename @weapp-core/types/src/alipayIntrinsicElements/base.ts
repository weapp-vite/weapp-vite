// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.alipay.json。

export type AlipayIntrinsicEventHandler<TReturn = unknown> = { bivarianceHack: (...args: unknown[]) => TReturn }['bivarianceHack']
export interface AlipayIntrinsicElementBaseAttributes {
  id?: string | number
  class?: string | Record<string, unknown> | false | null | undefined | unknown[]
  className?: string | Record<string, unknown> | false | null | undefined | unknown[]
  style?: string | Record<string, string | number | undefined> | false | null | undefined | unknown[]
  hidden?: boolean
  key?: string | number
  onTap?: AlipayIntrinsicEventHandler
  catchTap?: AlipayIntrinsicEventHandler
  captureBindTap?: AlipayIntrinsicEventHandler
  captureCatchTap?: AlipayIntrinsicEventHandler
  onTouchStart?: AlipayIntrinsicEventHandler
  onTouchMove?: AlipayIntrinsicEventHandler
  onTouchEnd?: AlipayIntrinsicEventHandler
  [name: `data-${string}`]: unknown
}
