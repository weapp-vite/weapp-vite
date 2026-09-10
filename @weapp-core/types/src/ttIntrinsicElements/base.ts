// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.tt.json。

export type TtIntrinsicEventHandler<TReturn = unknown> = { bivarianceHack: (...args: unknown[]) => TReturn }['bivarianceHack']
export interface TtIntrinsicElementBaseAttributes {
  id?: string | number
  class?: string | Record<string, unknown> | false | null | undefined | unknown[]
  className?: string | Record<string, unknown> | false | null | undefined | unknown[]
  style?: string | Record<string, string | number | undefined> | false | null | undefined | unknown[]
  hidden?: boolean
  key?: string | number
  onTap?: TtIntrinsicEventHandler
  catchTap?: TtIntrinsicEventHandler
  captureBindTap?: TtIntrinsicEventHandler
  captureCatchTap?: TtIntrinsicEventHandler
  onTouchStart?: TtIntrinsicEventHandler
  onTouchMove?: TtIntrinsicEventHandler
  onTouchEnd?: TtIntrinsicEventHandler
  [name: `data-${string}`]: unknown
}
