// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json。

export type WeappIntrinsicEventHandler<TReturn = unknown> = { bivarianceHack: (...args: unknown[]) => TReturn }['bivarianceHack']
export interface WeappIntrinsicElementBaseAttributes {
  id?: string | number
  class?: string | Record<string, unknown> | false | null | undefined | unknown[]
  className?: string | Record<string, unknown> | false | null | undefined | unknown[]
  style?: string | Record<string, string | number | undefined> | false | null | undefined | unknown[]
  hidden?: boolean
  key?: string | number
  onTap?: WeappIntrinsicEventHandler
  catchTap?: WeappIntrinsicEventHandler
  captureBindTap?: WeappIntrinsicEventHandler
  captureCatchTap?: WeappIntrinsicEventHandler
  onTouchStart?: WeappIntrinsicEventHandler
  onTouchMove?: WeappIntrinsicEventHandler
  onTouchEnd?: WeappIntrinsicEventHandler
  [name: `data-${string}`]: unknown
}
